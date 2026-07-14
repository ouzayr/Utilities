package com.ouzayr.tododiary.ui.weekly

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ouzayr.tododiary.data.AppSettings
import com.ouzayr.tododiary.data.DiaryRepository
import com.ouzayr.tododiary.data.SettingsRepository
import com.ouzayr.tododiary.model.DiaryPage
import com.ouzayr.tododiary.model.InputType
import com.ouzayr.tododiary.model.Task
import com.ouzayr.tododiary.model.TaskScope
import com.ouzayr.tododiary.model.TaskStatus
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

data class DayCell(
    val date: LocalDate,
    val openCount: Int,
    val doneCount: Int,
    val focusText: String?,
    val hasFocusInk: Boolean,
)

data class WeekUi(
    val weekId: String,
    val cells: List<DayCell>,
    val weekTasks: List<Task>,
)

@HiltViewModel
class WeeklyViewModel @Inject constructor(
    private val repo: DiaryRepository,
    settingsRepo: SettingsRepository,
) : ViewModel() {

    val settings: StateFlow<AppSettings> = settingsRepo.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, AppSettings())

    /**
     * Live data for the display week containing [anchor]. The ISO weekId is
     * taken from the middle of the display week so locale-dependent week
     * starts still map to a stable ISO week.
     */
    fun weekFlow(anchor: LocalDate): Flow<WeekUi> {
        val dates = DateUtils.displayWeekDates(anchor)
        val weekId = DateUtils.weekId(dates[3])
        return combine(
            repo.pagesForWeekFlow(dates),
            repo.tasksForWeekDaysFlow(dates),
            repo.tasksForWeekTasksFlow(weekId),
        ) { pages: Map<String, DiaryPage>, dayTasks: List<Task>, weekTasks: List<Task> ->
            val byDate = dayTasks.groupBy { it.pageDate }
            WeekUi(
                weekId = weekId,
                cells = dates.map { d ->
                    val key = DateUtils.format(d)
                    val t = byDate[key].orEmpty()
                    val page = pages[key]
                    DayCell(
                        date = d,
                        openCount = t.count { it.status == TaskStatus.OPEN },
                        doneCount = t.count { it.status == TaskStatus.DONE },
                        focusText = page?.focusText?.takeIf { it.isNotBlank() },
                        hasFocusInk = !page?.focusInkJson.isNullOrBlank(),
                    )
                },
                weekTasks = weekTasks,
            )
        }
    }

    private val saveJobs = HashMap<String, Job>()
    private fun debounced(key: String, block: suspend () -> Unit) {
        saveJobs[key]?.cancel()
        saveJobs[key] = viewModelScope.launch {
            delay(500)
            runCatching { block() }
        }
    }

    fun saveTaskInk(task: Task, json: String) =
        debounced("task-ink-${task.id}") { repo.updateTaskInk(task.id, json) }

    fun saveTaskText(task: Task, text: String) =
        debounced("task-text-${task.id}") { repo.updateTaskText(task.id, text) }

    fun addWeekTask(weekId: String, inputType: InputType) {
        viewModelScope.launch { runCatching { repo.addTask(TaskScope.WEEK, null, weekId, inputType) } }
    }

    fun toggleStatus(task: Task) {
        viewModelScope.launch { runCatching { repo.toggleTaskStatus(task) } }
    }

    fun deleteTask(task: Task) {
        viewModelScope.launch { runCatching { repo.deleteTask(task.id) } }
    }

    /** Assign a week task to a specific day (becomes a DAY task there). */
    fun assignToDay(task: Task, target: LocalDate) {
        viewModelScope.launch { runCatching { repo.carryTask(task, target, null) } }
    }

    /** Carry a week task to another week. */
    fun carryToWeek(task: Task, targetWeekAnchor: LocalDate) {
        viewModelScope.launch {
            runCatching { repo.carryTask(task, null, DateUtils.weekId(targetWeekAnchor)) }
        }
    }
}
