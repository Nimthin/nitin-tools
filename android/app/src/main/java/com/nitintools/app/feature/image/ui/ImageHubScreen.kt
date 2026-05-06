package com.nitintools.app.feature.image.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.nitintools.app.core.ui.theme.*

/**
 * Image Toolkit hub screen with sub-tool cards.
 */
@Composable
fun ImageHubScreen(
    onNavigate: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .statusBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "🖼️ Image Toolkit",
            style = MaterialTheme.typography.displayMedium,
            color = TextPrimary
        )

        Text(
            text = "All image processing runs on-device with AI — fully private",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary
        )

        Spacer(Modifier.height(8.dp))

        ImageToolButton(
            icon = Icons.Rounded.AutoFixHigh,
            title = "Background Remover",
            description = "Instantly strip the background from any image using on-device AI",
            color = AccentPurple,
            onClick = { onNavigate("background_remover") }
        )

        ImageToolButton(
            icon = Icons.Rounded.TextFields,
            title = "Image to Text (OCR)",
            description = "Extract text from any image using advanced optical character recognition",
            color = AccentCyan,
            onClick = { onNavigate("image_to_text") }
        )
    }
}

@Composable
private fun ImageToolButton(
    icon: ImageVector,
    title: String,
    description: String,
    color: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = DarkCard),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(color.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, title, tint = color, modifier = Modifier.size(24.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, color = TextPrimary)
                Text(description, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
            }
            Icon(Icons.Rounded.ChevronRight, "Go", tint = TextTertiary)
        }
    }
}
