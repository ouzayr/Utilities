package com.ouzayr.tododiary.ui.daily

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Redo
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.IosShare
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Today
import androidx.compose.material.icons.filled.ViewWeek
import androidx.compose.material.icons.outlined.Draw
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconToggleButton
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ouzayr.tododiary.ink.InkController
import com.ouzayr.tododiary.ink.InkSurface
import com.ouzayr.tododiary.ink.rememberInkController
import com.ouzayr.tododiary.model.InputType
import com.ouzayr.tododiary.model.Task
import com.ouzayr.tododiary.ui.components.PenConfig
import com.ouzayr.tododiary.ui.components.RuledLaneBackground
import com.ouzayr.tododiary.ui.components.TaskRow
import com.ouzayr.tododiary.ui.components.TaskRowActions
import com.ouzayr.tododiary.ui.components.TemplateBackground
import com.ouzayr.tododiary.util.DateUtils
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

// Pager index <-> date mapping: page 0 = 2000-01-01, ~200 years of pages.
private val BASE_DATE: LocalDate = LocalDate.of(2000, 1, 1)
private const val PAGE_COUNT = 73000

private fun pageOf(date: LocalDate): Int = (date.toEpochDay() - BASE_DATE.toEpochDay()).toInt()
private fun dateOf(page: Int): LocalDate = BASE_DATE.plusDays(page.toLong())

private fun LocalDate.toUtcMillis(): Long = atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
private fun Long.toLocalDate(): LocalDate = Instant.ofEpochMilli(this).atZone(ZoneOffset.UTC).toLocalDate()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DailyScreen(
    initialDate: LocalDate,
    onOpenWeekly: (LocalDate) -> Unit,
    onOpenSettings: () -> Unit,
    vm: DailyViewModel = hiltViewModel(),
) {
    val settings by vm.settings.collectAsState()
    val pagerState = rememberPagerState(initialPage = pageOf(initialDate)) { PAGE_COUNT }
    val currentDate = dateOf(pagerState.currentPage)
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var eraserMode by remember { mutableStateOf(false) }
    var showJumpPicker by remember { mutableStateOf(false) }
    var carryTarget by remember { mutableStateOf<Task?>(null) }
    var exportMenuOpen by remember { mutableStateOf(false) }
    var activeInk by remember { mutableStateOf<InkController?>(null) }

    // Undo/redo route to the last-touched ink surface of the visible page.
    LaunchedEffect(pagerState.currentPage) { activeInk = null }

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
            Column {
                TopAppBar(
                    title = { Text(DateUtils.dayHeader(currentDate), style = MaterialTheme.typography.titleMedium) },
                    actions = {
                        IconButton(onClick = {
                            scope.launch { pagerState.animateScrollToPage(pageOf(LocalDate.now())) }
                        }) {
                            Icon(Icons.Filled.Today, contentDescription = "Today")
                        }
                        IconButton(onClick = { showJumpPicker = true }) {
                            Icon(Icons.Filled.CalendarMonth, contentDescription = "Jump to date")
                        }
                        IconButton(onClick = { onOpenWeekly(currentDate) }) {
                            Icon(Icons.Filled.ViewWeek, contentDescription = "Weekly view")
                        }
                        IconButton(onClick = onOpenSettings) {
                            Icon(Icons.Filled.Settings, contentDescription = "Settings")
                        }
                    },
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    FilledIconToggleButton(checked = eraserMode, onCheckedChange = { eraserMode = it }) {
                        Icon(Icons.Outlined.Draw, contentDescription = "Eraser mode")
                    }
                    IconButton(
                        onClick = { activeInk?.undo() },
                        enabled = activeInk?.canUndo == true,
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Undo, contentDescription = "Undo")
                    }
                    IconButton(
                        onClick = { activeInk?.redo() },
                        enabled = activeInk?.canRedo == true,
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Redo, contentDescription = "Redo")
                    }
                    Box {
                        IconButton(onClick = { exportMenuOpen = true }) {
                            Icon(Icons.Filled.IosShare, contentDescription = "Export")
                        }
                        DropdownMenu(expanded = exportMenuOpen, onDismissRequest = { exportMenuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Export day (PDF)") },
                                onClick = {
                                    exportMenuOpen = false
                                    vm.exportAndShare(context, listOf(currentDate))
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Export week (PDF)") },
                                onClick = {
                                    exportMenuOpen = false
                                    vm.exportAndShare(context, DateUtils.displayWeekDates(currentDate))
                                },
                            )
                        }
                    }
                }
                HorizontalDivider()
            }
        },
    ) { padding ->
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            key = { it },
        ) { page ->
            val date = dateOf(page)
            DailyPageContent(
                date = date,
                isCurrent = page == pagerState.currentPage,
                pen = pen,
                vm = vm,
                onCarryRequest = { carryTarget = it },
                onActiveInk = { activeInk = it },
            )
        }
    }

    if (showJumpPicker) {
        val pickerState = rememberDatePickerState(initialSelectedDateMillis = currentDate.toUtcMillis())
        DatePickerDialog(
            onDismissRequest = { showJumpPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val millis = pickerState.selectedDateMillis
                    showJumpPicker = false
                    if (millis != null) {
                        scope.launch { pagerState.scrollToPage(pageOf(millis.toLocalDate())) }
                    }
                }) { Text("Go") }
            },
            dismissButton = {
                TextButton(onClick = { showJumpPicker = false }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = pickerState)
        }
    }

    carryTarget?.let { task ->
        // Default carry target: tomorrow (spec §12 default).
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = LocalDate.now().plusDays(1).toUtcMillis(),
        )
        DatePickerDialog(
            onDismissRequest = { carryTarget = null },
            confirmButton = {
                TextButton(onClick = {
                    val millis = pickerState.selectedDateMillis
                    carryTarget = null
                    if (millis != null) vm.carryToDate(task, millis.toLocalDate())
                }) { Text("Carry") }
            },
            dismissButton = {
                TextButton(onClick = { carryTarget = null }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = pickerState, title = {
                Text("Carry task to…", modifier = Modifier.padding(24.dp))
            })
        }
    }
}

@Composable
private fun DailyPageContent(
    date: LocalDate,
    isCurrent: Boolean,
    pen: PenConfig,
    vm: DailyViewModel,
    onCarryRequest: (Task) -> Unit,
    onActiveInk: (InkController) -> Unit,
) {
    val dayUi by remember(date) { vm.dayFlow(date) }.collectAsState(initial = null)
    val focusController = rememberInkController()
    val notesController = rememberInkController()

    LaunchedEffect(isCurrent) {
        if (isCurrent) onActiveInk(notesController)
    }

    val actions = TaskRowActions(
        onToggleStatus = vm::toggleStatus,
        onTextChanged = vm::saveTaskText,
        onInkChanged = vm::saveTaskInk,
        onCarryForward = onCarryRequest,
        onMoveToWeek = vm::moveToWeek,
        onAssignToDay = null,
        onDelete = vm::deleteTask,
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        val page = dayUi?.page

        // FOCUS line — freeform ink, mirrors the paper template's focus row.
        Text(
            "FOCUS",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.secondary,
            modifier = Modifier.padding(start = 16.dp, top = 8.dp),
        )
        val focusText = page?.focusText
        if (!focusText.isNullOrBlank()) {
            Text(
                focusText,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(72.dp)
                .padding(horizontal = 12.dp),
        ) {
            RuledLaneBackground(
                lineColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.6f),
                modifier = Modifier.fillMaxSize(),
            )
            InkSurface(
                inkJson = page?.focusInkJson,
                penColorHex = pen.colorHex,
                penWidthPx = pen.widthPx,
                pressureGamma = pen.pressureGamma,
                fingerDrawing = pen.fingerDrawing,
                eraserMode = pen.eraserMode,
                onInkChanged = {
                    vm.saveFocusInk(date, it)
                    onActiveInk(focusController)
                },
                controller = focusController,
                modifier = Modifier.fillMaxSize(),
            )
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

        // Task rows — unbounded, scrollable with the page.
        dayUi?.tasks.orEmpty().forEach { task ->
            TaskRow(task = task, pen = pen, actions = actions)
        }
        Row(modifier = Modifier.padding(horizontal = 12.dp)) {
            TextButton(onClick = { vm.addTask(date, InputType.INK) }) { Text("✎ Write task") }
            TextButton(onClick = { vm.addTask(date, InputType.TEXT) }) { Text("⌨ Type task") }
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

        // Notes / scribbles band with dot-grid template.
        Text(
            "NOTES",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.secondary,
            modifier = Modifier.padding(start = 16.dp),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(700.dp),
        ) {
            TemplateBackground(
                template = (page?.template) ?: com.ouzayr.tododiary.model.PageTemplate.DIARY,
                lineColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f),
                modifier = Modifier.fillMaxSize(),
            )
            InkSurface(
                inkJson = page?.notesInkJson,
                penColorHex = pen.colorHex,
                penWidthPx = pen.widthPx,
                pressureGamma = pen.pressureGamma,
                fingerDrawing = pen.fingerDrawing,
                eraserMode = pen.eraserMode,
                onInkChanged = {
                    vm.saveNotesInk(date, it)
                    onActiveInk(notesController)
                },
                controller = notesController,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}
