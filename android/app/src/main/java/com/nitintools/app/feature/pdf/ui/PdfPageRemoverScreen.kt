package com.nitintools.app.feature.pdf.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
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
 * PDF Page Remover — load a PDF, see page thumbnails, delete selected pages.
 */
@Composable
fun PdfPageRemoverScreen() {
    var pdfUri by remember { mutableStateOf<Uri?>(null) }
    var pageCount by remember { mutableIntStateOf(0) }
    var selectedPages by remember { mutableStateOf<Set<Int>>(emptySet()) }
    var isSaving by remember { mutableStateOf(false) }

    val pdfPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        pdfUri = uri
        // TODO: Use PdfRenderer to get page count and thumbnails
        pageCount = 10 // placeholder
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .statusBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("✂️ PDF Page Remover", style = MaterialTheme.typography.displayMedium, color = TextPrimary)
        Text("Select pages to remove from your PDF", style = MaterialTheme.typography.bodyMedium, color = TextSecondary)

        // Pick PDF button
        OutlinedButton(
            onClick = { pdfPicker.launch("application/pdf") },
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = AccentPink),
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Rounded.UploadFile, null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text(if (pdfUri != null) "PDF loaded • $pageCount pages" else "Select a PDF file")
        }

        if (pdfUri != null && pageCount > 0) {
            Text(
                "Tap pages to mark for removal (${selectedPages.size} selected)",
                style = MaterialTheme.typography.labelMedium,
                color = TextSecondary
            )

            // Page grid
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                itemsIndexed((1..pageCount).toList()) { _, page ->
                    val isSelected = selectedPages.contains(page)
                    Card(
                        onClick = {
                            selectedPages = if (isSelected) selectedPages - page else selectedPages + page
                        },
                        shape = RoundedCornerShape(8.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (isSelected) ErrorRed.copy(alpha = 0.15f) else DarkCard
                        ),
                        border = if (isSelected) CardDefaults.outlinedCardBorder().copy(
                            brush = androidx.compose.ui.graphics.SolidColor(ErrorRed)
                        ) else null,
                        modifier = Modifier.aspectRatio(0.7f)
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                if (isSelected) {
                                    Icon(Icons.Rounded.Delete, "Remove", tint = ErrorRed, modifier = Modifier.size(32.dp))
                                } else {
                                    Icon(Icons.Rounded.Description, "Page", tint = TextTertiary, modifier = Modifier.size(32.dp))
                                }
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    "Page $page",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = if (isSelected) ErrorRed else TextSecondary
                                )
                            }
                        }
                    }
                }
            }

            // Save button
            Button(
                onClick = {
                    isSaving = true
                    // TODO: Remove selected pages using PdfBox and save
                },
                enabled = selectedPages.isNotEmpty() && !isSaving,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AccentPink),
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                Icon(Icons.Rounded.Save, null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Remove ${selectedPages.size} page(s) & Save", style = MaterialTheme.typography.labelLarge, color = TextPrimary)
            }
        }
    }
}
