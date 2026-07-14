package com.ouzayr.tododiary.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import com.ouzayr.tododiary.model.PageTemplate

/**
 * Programmatic page backgrounds (spec §6). Drawn at render time behind the
 * ink layer; never stored per page.
 */
@Composable
fun TemplateBackground(
    template: PageTemplate,
    lineColor: Color,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    Canvas(modifier = modifier) {
        when (template) {
            PageTemplate.PLAIN -> Unit
            PageTemplate.DOT_GRID, PageTemplate.DIARY -> {
                val step = with(density) { 24.dp.toPx() }
                val r = with(density) { 1.dp.toPx() }
                var y = step
                while (y < size.height) {
                    var x = step
                    while (x < size.width) {
                        drawCircle(color = lineColor, radius = r, center = Offset(x, y))
                        x += step
                    }
                    y += step
                }
            }
        }
    }
}

/** A single ruled writing lane background (used for focus line + ink task rows). */
@Composable
fun RuledLaneBackground(
    lineColor: Color,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    Canvas(modifier = modifier) {
        val baseline = size.height - with(density) { 10.dp.toPx() }
        drawLine(
            color = lineColor,
            start = Offset(0f, baseline),
            end = Offset(size.width, baseline),
            strokeWidth = with(density) { 1.dp.toPx() },
        )
    }
}
