package com.nitintools.app.feature.pdf.ui

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
 * PDF Toolkit hub screen with sub-tool cards.
 */
@Composable
fun PdfHubScreen(
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
            text = "📄 PDF Toolkit",
            style = MaterialTheme.typography.displayMedium,
            color = TextPrimary
        )

        Text(
            text = "All PDF operations happen on your device — nothing is uploaded",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary
        )

        Spacer(Modifier.height(8.dp))

        PdfToolButton(
            icon = Icons.Rounded.Image,
            title = "Image to PDF",
            description = "Convert multiple images into a single PDF document",
            color = AccentBlue,
            onClick = { onNavigate("image_to_pdf") }
        )

        PdfToolButton(
            icon = Icons.Rounded.ContentCut,
            title = "PDF Page Remover",
            description = "Visually see all pages and remove the ones you don't want",
            color = AccentPink,
            onClick = { onNavigate("pdf_page_remover") }
        )

        PdfToolButton(
            icon = Icons.Rounded.MergeType,
            title = "PDF Merger",
            description = "Combine multiple PDFs into one continuous document",
            color = AccentPurple,
            onClick = { onNavigate("pdf_merger") }
        )
    }
}

@Composable
private fun PdfToolButton(
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
