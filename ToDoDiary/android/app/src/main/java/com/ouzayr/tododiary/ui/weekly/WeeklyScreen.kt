package com.ouzayr.tododiary.ui.weekly

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ouzayr.tododiary.model.InputType
import com.ouzayr.tododiary.model.Task
import com.ouzayr.tododiary.ui.components.PenConfig
import com.ouzayr.tododiary.ui.components.TaskRow
import com.ouzayr.tododiary.ui.components.TaskRowActions
import com.ouzayr.tododiary.util.DateUtils
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.TextStyle
import java.util.Locale

// Pager index <-> week mapping: page 0 = the display week containing 2000-01-01.
private val BASE_WEEK: LocalDate = LocalDate.of(2000, 1, 3)
private const val WEEK_PAGE_COUNT = 10500

private fun pageOfWeek(date: LocalDate): Int {
    val start = DateUtils.startOfDisplayWeek(date)
    val baseStart = DateUtils.startOfDisplayWeek(BASE_WEEK)
    return ((start.toEpochDay() - baseStart.toEpochDay()) / 7L).toInt()
}

private fun weekAnchorOf(page: Int): LocalDate {
    val baseStart = DateUtils.startOfDisplayWeek(BASE_WEEK)
    return baseStart.plusDays(page * 7L + 3L) // mid-week anchor
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WeeklyScreen(
    initialDate: LocalDate,
    onOpenDay: (LocalDate) -> Unit,
    onBack: () -> Unit,
    vm: WeeklyViewModel = hiltViewModel(),
) {
    val settings by vm.settings.collectAsState()
    val pagerState = rememberPagerState(initialPage = pageOfWeek(initialDate)) { WEEK_PAGE_COUNT }
    val scope = rememberCoroutineScope()
    val anchor = weekAnchorOf(pagerState.currentPage)

    var assignTarget by remember { mutableStateOf<Task?>(null) }
    var eraserMode by remember { mutableStateOf(false) }

    val penWidthPx = with(LocalDensity.current) { settings.penWidthDp.dp.toPx() }
    val pen = PenConfig(
        colorHex = settings.penColorHex,
        widthPx = penWidthPx,
        pressureGamma = settings.pressureGamma,
        fingerDrawing = settings.fingerDrawing,
        eraserMode = eraserMode,
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(DateUtils.weekHeader(anchor), style = MaterialTheme.typography.titleMedium)
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back to daily")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        scope.launch { pagerState.animateScrollToPage(pageOfWeek(LocalDate.now())) }
                    }) {
                        Icon(Icons.Filled.Today, contentDescription = "This week")
                    }
                },
            )
        },
    ) { padding ->
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            key = { it },
        ) { page ->
            WeekContent(
                anchor = weekAnchorOf(page),
                pen = pen,
                vm = vm,
                onOpenDay = onOpenDay,
                onAssignRequest = { assignTarget = it },
            )
        }
    }

    assignTarget?.let { task ->
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = LocalDate.now()
                .atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { assignTarget = null },
            confirmButton = {
                TextButton(onClick = {
                    val millis = pickerState.selectedDateMillis
                    assignTarget = null
                    if (millis != null) {
                        val date = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
                        vm.assignToDay(task, date)
                    }
                }) { Text("Assign") }
            },
            dismissButton = {
                TextButton(onClick = { assignTarget = null }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = pickerState, title = {
                Text("Assign task to a day…", modifier = Modifier.padding(24.dp))
            })
        }
    }
}

@Composable
private fun WeekContent(
    anchor: LocalDate,
    pen: PenConfig,
    vm: WeeklyViewModel,
    onOpenDay: (LocalDate) -> Unit,
    onAssignRequest: (Task) -> Unit,
) {
    val weekUi by remember(anchor) { vm.weekFlow(anchor) }.collectAsState(initial = null)

    val actions = TaskRowActions(
        onToggleStatus = vm::toggleStatus,
        onTextChanged = vm::saveTaskText,
        onInkChanged = vm::saveTaskInk,
        onCarryForward = { task -> vm.carryToWeek(task, anchor.plusWeeks(1)) },
        onMoveToWeek = null,
        onAssignToDay = onAssignRequest,
        onDelete = vm::deleteTask,
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 12.dp),
    ) {
        Spacer(modifier = Modifier.padding(top = 4.dp))
        val today = LocalDate.now()
        weekUi?.cells.orEmpty().forEach { cell ->
            DayCellCard(cell = cell, isToday = cell.date == today, onClick = { onOpenDay(cell.date) })
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
        Text(
            "THIS WEEK",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.secondary,
        )
        Text(
            "Tasks for the whole week — assign to a day when you're ready.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        weekUi?.weekTasks.orEmpty().forEach { task ->
            TaskRow(task = task, pen = pen, actions = actions)
        }
        weekUi?.let { ui ->
            Row {
                TextButton(onClick = { vm.addWeekTask(ui.weekId, InputType.INK) }) { Text("✎ Write task") }
                TextButton(onClick = { vm.addWeekTask(ui.weekId, InputType.TEXT) }) { Text("⌨ Type task") }
            }
        }
        Spacer(modifier = Modifier.padding(bottom = 24.dp))
    }
}

@Composable
private fun DayCellCard(cell: DayCell, isToday: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp)
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (isToday) {
                MaterialTheme.colorScheme.surfaceVariant
            } else {
                MaterialTheme.colorScheme.surface
            },
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(modifier = Modifier.width(84.dp)) {
                Text(
                    cell.date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault()),
                    style = MaterialTheme.typography.labelMedium,
                    color = if (isToday) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "${cell.date.dayOfMonth}",
                    style = MaterialTheme.typography.titleLarge,
                    color = if (isToday) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                val focus = cell.focusText ?: if (cell.hasFocusInk) "✎ focus written in ink" else null
                if (focus != null) {
                    Text(
                        focus,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text(
                    "${cell.openCount} open · ${cell.doneCount} done",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
