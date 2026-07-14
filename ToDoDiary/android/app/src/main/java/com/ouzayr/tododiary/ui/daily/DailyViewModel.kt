package com.ouzayr.tododiary.ui.daily

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ouzayr.tododiary.data.AppSettings
import com.ouzayr.tododiary.data.DiaryRepository
import com.ouzayr.tododiary.data.SettingsRepository
import com.ouzayr.tododiary.export.PdfExporter
import com.ouzayr.tododiary.model.DiaryPage
import com.ouzayr.tododiary.model.InputType
import com.ouzayr.tododiary.model.Task
import com.ouzayr.tododiary.model.TaskScope
import com.ouzayr.tododiary.util.DateUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class DayUi(
    val page: DiaryPage,
    val tasks: List<Task>,
)

@HiltViewModel
class DailyViewModel @Inject constructor(
    private val repo: DiaryRepository,
    settingsRepo: SettingsRepository,
) : ViewModel() {

    val settings: StateFlow<AppSettings> = settingsRepo.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, AppSettings())

    fun dayFlow(date: LocalDate): Flow<DayUi> =
        combine(repo.pageFlow(date), repo.tasksForDayFlow(date)) { page, tasks ->
            DayUi(page, tasks)
        }

    // Debounced autosave: one pending write per surface, cancelled and
    // re-scheduled on every pen-up so fast writing batches into few writes.
    private val saveJobs = HashMap<String, Job>()
    private fun debounced(key: String, block: suspend () -> Unit) {
        saveJobs[key]?.cancel()
        saveJobs[key] = viewModelScope.launch {
            delay(500)
            runCatching { block() }
        }
    }

    fun saveNotesInk(date: LocalDate, json: String) =
        debounced("notes-$date") { repo.saveNotesInk(date, json) }

    fun saveFocusInk(date: LocalDate, json: String) =
        debounced("focus-$date") { repo.saveFocusInk(date, json) }

    fun saveTaskInk(task: Task, json: String) =
        debounced("task-ink-${task.id}") { repo.updateTaskInk(task.id, json) }

    fun saveTaskText(task: Task, text: String) =
        debounced("task-text-${task.id}") { repo.updateTaskText(task.id, text) }

    fun addTask(date: LocalDate, inputType: InputType) {
        viewModelScope.launch {
            runCatching {
                repo.addTask(TaskScope.DAY, date, DateUtils.weekId(date), inputType)
            }
        }
    }

    fun toggleStatus(task: Task) {
        viewModelScope.launch { runCatching { repo.toggleTaskStatus(task) } }
    }

    fun deleteTask(task: Task) {
        viewModelScope.launch { runCatching { repo.deleteTask(task.id) } }
    }

    /** Carry an open task to another day (default target: tomorrow). */
    fun carryToDate(task: Task, target: LocalDate) {
        viewModelScope.launch { runCatching { repo.carryTask(task, target, null) } }
    }

    /** Promote a day task to its week's list. */
    fun moveToWeek(task: Task) {
        val date = task.pageDate?.let { DateUtils.parse(it) } ?: return
        viewModelScope.launch { runCatching { repo.carryTask(task, null, DateUtils.weekId(date)) } }
    }

    /** Render the given dates to a PDF and open the system share sheet. */
    fun exportAndShare(context: Context, dates: List<LocalDate>) {
        viewModelScope.launch {
            runCatching {
                val pages = dates.map { d -> Triple(d, repo.getPage(d), repo.getTasksForDay(d)) }
                val file = PdfExporter.export(context, pages)
                PdfExporter.share(context, file)
            }
        }
    }
}
