package com.ouzayr.tododiary.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Canvas
import androidx.compose.ui.focus.onFocusChanged
import com.ouzayr.tododiary.ink.InkSurface
import com.ouzayr.tododiary.model.InputType
import com.ouzayr.tododiary.model.Task
import com.ouzayr.tododiary.model.TaskScope
import com.ouzayr.tododiary.model.TaskStatus
import com.ouzayr.tododiary.util.DateUtils

/** Extra actions offered in the row menu, provided by the hosting screen. */
data class TaskRowActions(
    val onToggleStatus: (Task) -> Unit,
    val onTextChanged: (Task, String) -> Unit,
    val onInkChanged: (Task, String) -> Unit,
    val onCarryForward: (Task) -> Unit,
    val onMoveToWeek: ((Task) -> Unit)?,
    val onAssignToDay: ((Task) -> Unit)?,
    val onDelete: (Task) -> Unit,
)

/** Pen config passed down to ink lanes. */
data class PenConfig(
    val colorHex: String,
    val widthPx: Float,
    val pressureGamma: Float,
    val fingerDrawing: Boolean,
    val eraserMode: Boolean,
)

@Composable
fun TaskRow(
    task: Task,
    pen: PenConfig,
    actions: TaskRowActions,
    modifier: Modifier = Modifier,
) {
    val carried = task.status == TaskStatus.CARRIED
    val done = task.status == TaskStatus.DONE
    val contentAlpha = if (carried) 0.45f else 1f

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StatusCheckbox(
            status = task.status,
            onClick = { if (!carried) actions.onToggleStatus(task) },
        )

        Box(
            modifier = Modifier
                .weight(1f)
                .alpha(contentAlpha),
        ) {
            when (task.inputType) {
                InputType.TEXT -> TextTaskContent(task, done, actions)
                InputType.INK -> InkTaskContent(task, done, carried, pen, actions)
            }
        }

        if (carried && task.carriedToDate != null) {
            Text(
                text = DateUtils.carriedTag(task.carriedToDate),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.secondary,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }

        RowMenu(task, actions)
    }
}

@Composable
private fun StatusCheckbox(status: TaskStatus, onClick: () -> Unit) {
    val done = status == TaskStatus.DONE
    Box(
        modifier = Modifier
            .padding(end = 6.dp)
            .size(26.dp)
            .border(
                width = 2.dp,
                color = if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                shape = CircleShape,
            )
            .background(
                color = if (done) MaterialTheme.colorScheme.primary else Color.Transparent,
                shape = CircleShape,
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (done) {
            Icon(
                imageVector = Icons.Filled.Check,
                contentDescription = "Done",
                tint = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier.size(16.dp),
            )
        } else if (status == TaskStatus.CARRIED) {
            Text("→", color = MaterialTheme.colorScheme.outline, style = MaterialTheme.typography.labelMedium)
        }
    }
}

@Composable
private fun TextTaskContent(task: Task, done: Boolean, actions: TaskRowActions) {
    var text by remember(task.id) { mutableStateOf(task.textContent ?: "") }
    var focused by remember(task.id) { mutableStateOf(false) }

    // Accept remote updates only while the field is not being edited.
    LaunchedEffect(task.textContent) {
        if (!focused && task.textContent != null && task.textContent != text) {
            text = task.textContent
        }
    }

    TextField(
        value = text,
        onValueChange = {
            text = it
            actions.onTextChanged(task, it)
        },
        modifier = Modifier
            .fillMaxWidth()
            .onFocusChanged { focused = it.isFocused },
        textStyle = if (done) {
            TextStyle(textDecoration = TextDecoration.LineThrough)
        } else {
            TextStyle(textDecoration = TextDecoration.None)
        },
        placeholder = { Text("Task…") },
        singleLine = false,
        maxLines = 3,
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = Color.Transparent,
            unfocusedContainerColor = Color.Transparent,
            disabledContainerColor = Color.Transparent,
        ),
        readOnly = task.status == TaskStatus.CARRIED,
    )
}

@Composable
private fun InkTaskContent(
    task: Task,
    done: Boolean,
    carried: Boolean,
    pen: PenConfig,
    actions: TaskRowActions,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(64.dp),
    ) {
        RuledLaneBackground(
            lineColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
            modifier = Modifier.fillMaxSize(),
        )
        InkSurface(
            inkJson = task.inkJson,
            penColorHex = pen.colorHex,
            penWidthPx = pen.widthPx,
            pressureGamma = pen.pressureGamma,
            fingerDrawing = pen.fingerDrawing && !carried,
            eraserMode = pen.eraserMode,
            onInkChanged = { json -> actions.onInkChanged(task, json) },
            modifier = Modifier.fillMaxSize(),
        )
        if (done) {
            // Non-destructive strike-through across the whole ink lane.
            val strike = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
            Canvas(modifier = Modifier.fillMaxSize()) {
                drawLine(
                    color = strike,
                    start = Offset(size.width * 0.02f, size.height * 0.55f),
                    end = Offset(size.width * 0.98f, size.height * 0.48f),
                    strokeWidth = 4f,
                )
            }
        }
    }
}

@Composable
private fun RowMenu(task: Task, actions: TaskRowActions) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }, modifier = Modifier.size(32.dp)) {
            Icon(
                imageVector = Icons.Filled.MoreVert,
                contentDescription = "Task actions",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            if (task.status == TaskStatus.OPEN) {
                DropdownMenuItem(
                    text = { Text("Carry forward…") },
                    onClick = { open = false; actions.onCarryForward(task) },
                )
                if (task.scope == TaskScope.DAY && actions.onMoveToWeek != null) {
                    DropdownMenuItem(
                        text = { Text("Move to week") },
                        onClick = { open = false; actions.onMoveToWeek.invoke(task) },
                    )
                }
                if (task.scope == TaskScope.WEEK && actions.onAssignToDay != null) {
                    DropdownMenuItem(
                        text = { Text("Assign to a day…") },
                        onClick = { open = false; actions.onAssignToDay.invoke(task) },
                    )
                }
            }
            DropdownMenuItem(
                text = { Text("Delete") },
                onClick = { open = false; actions.onDelete(task) },
            )
        }
    }
}
