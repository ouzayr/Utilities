package com.ouzayr.tododiary.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.ouzayr.tododiary.model.CarryLink
import com.ouzayr.tododiary.model.DiaryPage
import com.ouzayr.tododiary.model.InputType
import com.ouzayr.tododiary.model.PageTemplate
import com.ouzayr.tododiary.model.Task
import com.ouzayr.tododiary.model.TaskScope
import com.ouzayr.tododiary.model.TaskStatus
import com.ouzayr.tododiary.util.DateUtils
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Single source of truth: Firestore (offline persistence is on by default on
 * Android, so reads/writes keep working without a connection and sync later).
 *
 * Layout (mirrored by the web app):
 *   users/{uid}/pages/{yyyy-MM-dd}   – one diary page per day
 *   users/{uid}/tasks/{autoId}       – day- and week-scoped tasks
 *   users/{uid}/carryLinks/{autoId}  – audit trail of carry-forward moves
 */
@Singleton
class DiaryRepository @Inject constructor(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth,
) {
    private fun uid(): String = auth.currentUser?.uid ?: error("Not signed in")

    private fun pages() = db.collection("users").document(uid()).collection("pages")
    private fun tasks() = db.collection("users").document(uid()).collection("tasks")
    private fun carryLinks() = db.collection("users").document(uid()).collection("carryLinks")

    private fun now() = System.currentTimeMillis()

    // ---- pages ----

    fun pageFlow(date: LocalDate): Flow<DiaryPage> = callbackFlow {
        val key = DateUtils.format(date)
        val reg = pages().document(key).addSnapshotListener { snap, _ ->
            val data = snap?.data
            trySend(if (data != null) DiaryPage.fromMap(key, data) else DiaryPage(date = key))
        }
        awaitClose { reg.remove() }
    }

    fun pagesForWeekFlow(dates: List<LocalDate>): Flow<Map<String, DiaryPage>> = callbackFlow {
        val keys = dates.map { DateUtils.format(it) }
        val reg = pages().whereIn(FieldPath.documentId(), keys)
            .addSnapshotListener { snap, _ ->
                val map = HashMap<String, DiaryPage>()
                snap?.documents?.forEach { doc ->
                    doc.data?.let { map[doc.id] = DiaryPage.fromMap(doc.id, it) }
                }
                trySend(map)
            }
        awaitClose { reg.remove() }
    }

    suspend fun savePageField(date: LocalDate, field: String, value: Any?) {
        val key = DateUtils.format(date)
        pages().document(key).set(
            mapOf(field to value, "updatedAt" to now()),
            SetOptions.merge(),
        ).await()
    }

    suspend fun saveNotesInk(date: LocalDate, inkJson: String) = savePageField(date, "notesInkJson", inkJson)
    suspend fun saveFocusInk(date: LocalDate, inkJson: String) = savePageField(date, "focusInkJson", inkJson)
    suspend fun saveFocusText(date: LocalDate, text: String) = savePageField(date, "focusText", text)
    suspend fun savePageTemplate(date: LocalDate, template: PageTemplate) =
        savePageField(date, "template", template.name)

    // ---- tasks ----

    fun tasksForDayFlow(date: LocalDate): Flow<List<Task>> = callbackFlow {
        val key = DateUtils.format(date)
        val reg = tasks().whereEqualTo("pageDate", key)
            .addSnapshotListener { snap, _ ->
                trySend(snap.toTasks())
            }
        awaitClose { reg.remove() }
    }

    fun tasksForWeekTasksFlow(weekId: String): Flow<List<Task>> = callbackFlow {
        val reg = tasks().whereEqualTo("weekId", weekId).whereEqualTo("scope", TaskScope.WEEK.name)
            .addSnapshotListener { snap, _ ->
                trySend(snap.toTasks())
            }
        awaitClose { reg.remove() }
    }

    /** All day-scoped tasks for the 7 dates of a display week (for the overview grid). */
    fun tasksForWeekDaysFlow(dates: List<LocalDate>): Flow<List<Task>> = callbackFlow {
        val keys = dates.map { DateUtils.format(it) }
        val reg = tasks().whereIn("pageDate", keys)
            .addSnapshotListener { snap, _ ->
                trySend(snap.toTasks())
            }
        awaitClose { reg.remove() }
    }

    private fun com.google.firebase.firestore.QuerySnapshot?.toTasks(): List<Task> =
        this?.documents
            ?.mapNotNull { doc -> doc.data?.let { Task.fromMap(doc.id, it) } }
            ?.sortedBy { it.rowIndex }
            ?: emptyList()

    /** One-shot reads used by the PDF exporter. */
    suspend fun getPage(date: LocalDate): DiaryPage {
        val key = DateUtils.format(date)
        val snap = pages().document(key).get().await()
        return snap.data?.let { DiaryPage.fromMap(key, it) } ?: DiaryPage(date = key)
    }

    suspend fun getTasksForDay(date: LocalDate): List<Task> {
        val key = DateUtils.format(date)
        val snap = tasks().whereEqualTo("pageDate", key).get().await()
        return snap.documents
            .mapNotNull { doc -> doc.data?.let { Task.fromMap(doc.id, it) } }
            .sortedBy { it.rowIndex }
    }

    suspend fun addTask(
        scope: TaskScope,
        date: LocalDate?,
        weekId: String?,
        inputType: InputType,
        textContent: String? = null,
    ): String {
        val t = now()
        val task = Task(
            scope = scope,
            pageDate = date?.let { DateUtils.format(it) },
            weekId = weekId,
            rowIndex = t,
            status = TaskStatus.OPEN,
            inputType = inputType,
            textContent = textContent,
            createdAt = t,
            updatedAt = t,
        )
        val ref = tasks().document()
        ref.set(task.toMap()).await()
        return ref.id
    }

    suspend fun updateTaskText(taskId: String, text: String) {
        tasks().document(taskId).update(mapOf("textContent" to text, "updatedAt" to now())).await()
    }

    suspend fun updateTaskInk(taskId: String, inkJson: String) {
        tasks().document(taskId).update(mapOf("inkJson" to inkJson, "updatedAt" to now())).await()
    }

    suspend fun toggleTaskStatus(task: Task) {
        val newStatus = if (task.status == TaskStatus.DONE) TaskStatus.OPEN else TaskStatus.DONE
        tasks().document(task.id).update(mapOf("status" to newStatus.name, "updatedAt" to now())).await()
    }

    suspend fun deleteTask(taskId: String) {
        tasks().document(taskId).delete().await()
    }

    /**
     * Carry an OPEN task forward: copy content to the target day (or week),
     * mark the source CARRIED, and record a CarryLink — one atomic batch.
     * Also used for week→day assignment and day→week promotion.
     */
    suspend fun carryTask(source: Task, targetDate: LocalDate?, targetWeekId: String?) {
        require(targetDate != null || targetWeekId != null)
        val t = now()
        val targetKey = targetDate?.let { DateUtils.format(it) } ?: targetWeekId!!
        val copy = Task(
            scope = if (targetDate != null) TaskScope.DAY else TaskScope.WEEK,
            pageDate = targetDate?.let { DateUtils.format(it) },
            weekId = if (targetDate != null) DateUtils.weekId(targetDate) else targetWeekId,
            rowIndex = t,
            status = TaskStatus.OPEN,
            inputType = source.inputType,
            textContent = source.textContent,
            inkJson = source.inkJson,
            createdAt = t,
            updatedAt = t,
        )
        val link = CarryLink(
            sourceTaskId = source.id,
            sourceScopeKey = source.pageDate ?: source.weekId.orEmpty(),
            targetKey = targetKey,
            createdAt = t,
        )
        val batch = db.batch()
        batch.set(tasks().document(), copy.toMap())
        batch.update(
            tasks().document(source.id),
            mapOf("status" to TaskStatus.CARRIED.name, "carriedToDate" to targetKey, "updatedAt" to t),
        )
        batch.set(carryLinks().document(), link.toMap())
        batch.commit().await()
    }
}
