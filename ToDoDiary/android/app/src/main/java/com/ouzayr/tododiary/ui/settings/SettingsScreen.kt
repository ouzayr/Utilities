package com.ouzayr.tododiary.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ouzayr.tododiary.data.DarkModeSetting
import com.ouzayr.tododiary.model.PageTemplate

private val PEN_COLORS = listOf(
    "#1A237E", // ink blue
    "#000000", // black
    "#B71C1C", // red
    "#1B5E20", // green
    "#4A148C", // purple
    "#B8860B", // brass
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    vm: SettingsViewModel = hiltViewModel(),
) {
    val settings by vm.settings.collectAsState()
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SectionLabel("PEN")
            Text("Colour", style = MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PEN_COLORS.forEach { hex ->
                    val selected = settings.penColorHex.equals(hex, ignoreCase = true)
                    Column(
                        modifier = Modifier
                            .size(36.dp)
                            .border(
                                width = if (selected) 3.dp else 1.dp,
                                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                                shape = CircleShape,
                            )
                            .padding(4.dp)
                            .background(Color(android.graphics.Color.parseColor(hex)), CircleShape)
                            .clickable { vm.setPenColor(hex) },
                    ) {}
                }
            }

            Text("Base width: %.1f dp".format(settings.penWidthDp), style = MaterialTheme.typography.bodyMedium)
            Slider(
                value = settings.penWidthDp,
                onValueChange = { vm.setPenWidth(it) },
                valueRange = 0.8f..5f,
            )

            Text(
                "Pressure response: %.2f (lower = flatter, higher = more contrast)".format(settings.pressureGamma),
                style = MaterialTheme.typography.bodyMedium,
            )
            Slider(
                value = settings.pressureGamma,
                onValueChange = { vm.setPressureGamma(it) },
                valueRange = 0.4f..2.5f,
            )

            HorizontalDivider()
            SectionLabel("PAGE")
            Text("Template", style = MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PageTemplate.entries.forEach { t ->
                    FilterChip(
                        selected = settings.template == t,
                        onClick = { vm.setTemplate(t) },
                        label = { Text(t.name.lowercase().replace('_', ' ')) },
                    )
                }
            }

            HorizontalDivider()
            SectionLabel("INPUT")
            SettingSwitch(
                title = "Palm rejection",
                subtitle = "Only the S Pen draws; fingers scroll. Turn off to allow finger drawing.",
                checked = !settings.fingerDrawing,
                onCheckedChange = { vm.setFingerDrawing(!it) },
            )

            HorizontalDivider()
            SectionLabel("APPEARANCE")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DarkModeSetting.entries.forEach { m ->
                    FilterChip(
                        selected = settings.darkMode == m,
                        onClick = { vm.setDarkMode(m) },
                        label = { Text(m.name.lowercase()) },
                    )
                }
            }

            HorizontalDivider()
            SectionLabel("ACCOUNT")
            Text(
                vm.userName ?: "Signed in",
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                vm.userEmail ?: "",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(onClick = { vm.signOut(context) }) {
                Text("Sign out")
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.secondary,
        modifier = Modifier.padding(top = 12.dp),
    )
}

@Composable
private fun SettingSwitch(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyMedium)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}
