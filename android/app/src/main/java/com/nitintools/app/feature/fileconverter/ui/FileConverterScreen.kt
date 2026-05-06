package com.nitintools.app.feature.fileconverter.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.nitintools.app.core.ui.theme.*

/**
 * File Converter screen — pick a file and convert it to another format.
 */
@Composable
fun FileConverterScreen() {
    var selectedFile by remember { mutableStateOf<String?>(null) }
    var targetFormat by remember { mutableStateOf("PDF") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .statusBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "🔄 File Converter",
            style = MaterialTheme.typography.displayMedium,
            color = TextPrimary
        )

        Text(
            text = "Convert files between formats — documents, images, audio, or video",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary
        )

        Spacer(Modifier.height(16.dp))

        // File picker button
        Card(
            onClick = { /* TODO: Launch file picker */ },
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkCard),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(AccentOrange.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Rounded.UploadFile, "Upload", tint = AccentOrange, modifier = Modifier.size(32.dp))
                }
                Text(
                    "Tap to select a file",
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimary
                )
                Text(
                    "Supports documents, images, audio, and video",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextTertiary
                )
            }
        }

        // Format selector
        Text("Convert to:", style = MaterialTheme.typography.labelLarge, color = TextSecondary)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("PDF", "PNG", "JPG", "MP3", "MP4").forEach { fmt ->
                FilterChip(
                    selected = targetFormat == fmt,
                    onClick = { targetFormat = fmt },
                    label = { Text(fmt) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = AccentOrange,
                        selectedLabelColor = TextOnAccent
                    )
                )
            }
        }

        Spacer(Modifier.weight(1f))

        // Convert button
        Button(
            onClick = { /* TODO: Convert file */ },
            enabled = selectedFile != null,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            Icon(Icons.Rounded.Transform, null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("Convert File", style = MaterialTheme.typography.labelLarge, color = TextOnAccent)
        }
    }
}
