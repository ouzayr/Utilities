package com.ouzayr.tododiary.model

enum class TaskScope { DAY, WEEK }

enum class TaskStatus { OPEN, DONE, CARRIED }

enum class InputType { INK, TEXT }

enum class PageTemplate { DIARY, DOT_GRID, PLAIN }

/**
 * A single task row. Belongs either to a day (`scope = DAY`, `pageDate` set)
 * or to a whole week (`scope = WEEK`, `weekId` set). Content is either typed
 * (`textContent`) or handwritten (`inkJson`, portable stroke JSON — see InkModel).
 *
 * Dates are ISO strings ("2026-07-13") and weeks are ISO week keys ("2026-W28")
 * so documents are directly readable by the web app.
 */
data class Task(
    val id: String = "",
    val scope: TaskScope = TaskScope.DAY,
    val pageDate: String? = null,
    val weekId: String? = null,
    /** Sort key within its list; epoch millis at creation so new rows append. */
    val rowIndex: Long = 0L,
    val status: TaskStatus = TaskStatus.OPEN,
    val inputType: InputType = InputType.TEXT,
    val textContent: String? = null,
    val inkJson: String? = null,
    val carriedToDate: String? = null,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L,
) {
    fun toMap(): Map<String, Any?> = mapOf(
        "scope" to scope.name,
        "pageDate" to pageDate,
        "weekId" to weekId,
        "rowIndex" to rowIndex,
        "status" to status.name,
        "inputType" to inputType.name,
        "textContent" to textContent,
        "inkJson" to inkJson,
        "carriedToDate" to carriedToDate,
        "createdAt" to createdAt,
        "updatedAt" to updatedAt,
    )

    companion object {
        fun fromMap(id: String, data: Map<String, Any?>): Task = Task(
            id = id,
            scope = runCatching { TaskScope.valueOf(data["scope"] as? String ?: "DAY") }.getOrDefault(TaskScope.DAY),
            pageDate = data["pageDate"] as? String,
            weekId = data["weekId"] as? String,
            rowIndex = (data["rowIndex"] as? Number)?.toLong() ?: 0L,
            status = runCatching { TaskStatus.valueOf(data["status"] as? String ?: "OPEN") }.getOrDefault(TaskStatus.OPEN),
            inputType = runCatching { InputType.valueOf(data["inputType"] as? String ?: "TEXT") }.getOrDefault(InputType.TEXT),
            textContent = data["textContent"] as? String,
            inkJson = data["inkJson"] as? String,
            carriedToDate = data["carriedToDate"] as? String,
            createdAt = (data["createdAt"] as? Number)?.toLong() ?: 0L,
            updatedAt = (data["updatedAt"] as? Number)?.toLong() ?: 0L,
        )
    }
}

/**
 * One diary page per calendar day. Document id in Firestore is the ISO date.
 * Ink layers are stored inline as portable stroke JSON (compact; a full page of
 * handwriting stays well under Firestore's 1 MB document limit).
 */
data class DiaryPage(
    val date: String = "",
    val focusInkJson: String? = null,
    val focusText: String? = null,
    val notesInkJson: String? = null,
    val template: PageTemplate = PageTemplate.DIARY,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L,
) {
    companion object {
        fun fromMap(date: String, data: Map<String, Any?>): DiaryPage = DiaryPage(
            date = date,
            focusInkJson = data["focusInkJson"] as? String,
            focusText = data["focusText"] as? String,
            notesInkJson = data["notesInkJson"] as? String,
            template = runCatching { PageTemplate.valueOf(data["template"] as? String ?: "DIARY") }
                .getOrDefault(PageTemplate.DIARY),
            createdAt = (data["createdAt"] as? Number)?.toLong() ?: 0L,
            updatedAt = (data["updatedAt"] as? Number)?.toLong() ?: 0L,
        )
    }
}

/** Audit record written whenever a task is carried/deferred to another date or week. */
data class CarryLink(
    val id: String = "",
    val sourceTaskId: String = "",
    val sourceScopeKey: String = "",
    val targetKey: String = "",
    val createdAt: Long = 0L,
) {
    fun toMap(): Map<String, Any?> = mapOf(
        "sourceTaskId" to sourceTaskId,
        "sourceScopeKey" to sourceScopeKey,
        "targetKey" to targetKey,
        "createdAt" to createdAt,
    )
}
