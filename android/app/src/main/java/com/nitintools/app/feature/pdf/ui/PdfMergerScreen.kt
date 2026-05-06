package com.nitintools.app.feature.pdf.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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
 * PDF Merger — pick multiple PDFs, reorder, and merge into one.
 */
@Composable
fun PdfMergerScreen() {
    var selectedPdfs by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var isMerging by remember { mutableStateOf(false) }
    var isComplete by remember { mutableStateOf(false) }

    val pdfPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris -> selectedPdfs = selectedPdfs + uris }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .statusBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("🔗 PDF Merger", style = MaterialTheme.typography.displayMedium, color = TextPrimary)
        Text("Combine multiple PDFs into one document", style = MaterialTheme.typography.bodyMedium, color = TextSecondary)

        // Add PDFs button
        OutlinedButton(
            onClick = { pdfPicker.launch("application/pdf") },
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = AccentPurple),
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Rounded.Add, null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("Add PDF Files (${selectedPdfs.size} selected)")
        }

        // PDF list
        if (selectedPdfs.isNotEmpty()) {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                itemsIndexed(selectedPdfs) { index, uri ->
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = DarkCard),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(AccentPurple.copy(alpha = 0.12f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("${index + 1}", style = MaterialTheme.typography.titleMedium, color = AccentPurple)
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    "PDF Document ${index + 1}",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = TextPrimary
                                )
                                Text(
                                    uri.lastPathSegment ?: "Unknown",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextTertiary,
                                    maxLines = 1
                                )
                            }
                            IconButton(
                                onClick = { selectedPdfs = selectedPdfs.toMutableList().apply { removeAt(index) } },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(Icons.Rounded.Close, "Remove", tint = ErrorRed, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        } else {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(DarkCard),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Rounded.MergeType, null, tint = TextTertiary, modifier = Modifier.size(48.dp))
                    Text("No PDFs selected", style = MaterialTheme.typography.bodyMedium, color = TextTertiary)
                }
            }
        }

        // Merge button
        Button(
            onClick = {
                isMerging = true
                // TODO: Use PdfBox to merge all PDFs in order
            },
            enabled = selectedPdfs.size >= 2 && !isMerging,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AccentPurple),
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            if (isMerging) {
                CircularProgressIndicator(color = TextPrimary, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Merging...", color = TextPrimary)
            } else {
                Icon(Icons.Rounded.MergeType, null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Merge ${selectedPdfs.size} PDFs", style = MaterialTheme.typography.labelLarge, color = TextPrimary)
            }
        }

        if (isComplete) {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = SuccessGreen.copy(alpha = 0.12f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Rounded.CheckCircle, null, tint = SuccessGreen)
                    Text("PDFs merged successfully!", style = MaterialTheme.typography.bodyMedium, color = SuccessGreen)
                }
            }
        }
    }
}
