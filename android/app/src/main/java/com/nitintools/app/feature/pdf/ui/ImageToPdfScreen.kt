package com.nitintools.app.feature.pdf.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nitintools.app.core.ui.theme.*

/**
 * Image to PDF — pick images, reorder, and generate a PDF.
 */
@Composable
fun ImageToPdfScreen() {
    var selectedImages by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var isGenerating by remember { mutableStateOf(false) }
    var isComplete by remember { mutableStateOf(false) }
    val context = LocalContext.current

    val imagePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris -> selectedImages = selectedImages + uris }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .statusBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("📸 Image to PDF", style = MaterialTheme.typography.displayMedium, color = TextPrimary)
        Text("Select images, reorder them, then generate a PDF", style = MaterialTheme.typography.bodyMedium, color = TextSecondary)

        // Add images button
        OutlinedButton(
            onClick = { imagePicker.launch("image/*") },
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = AccentBlue),
            border = ButtonDefaults.outlinedButtonBorder.copy(brush = androidx.compose.ui.graphics.SolidColor(AccentBlue)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Rounded.AddPhotoAlternate, null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("Add Images (${selectedImages.size} selected)")
        }

        // Image grid preview
        if (selectedImages.isNotEmpty()) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(4.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                itemsIndexed(selectedImages) { index, uri ->
                    Box(modifier = Modifier.aspectRatio(1f)) {
                        AsyncImage(
                            model = uri,
                            contentDescription = "Image ${index + 1}",
                            modifier = Modifier
                                .fillMaxSize()
                                .clip(RoundedCornerShape(8.dp))
                                .border(1.dp, BorderColor, RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Crop
                        )
                        // Page number badge
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopStart)
                                .padding(4.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(DarkBackground.copy(alpha = 0.8f))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text("${index + 1}", style = MaterialTheme.typography.labelSmall, color = TextPrimary)
                        }
                        // Remove button
                        IconButton(
                            onClick = { selectedImages = selectedImages.toMutableList().apply { removeAt(index) } },
                            modifier = Modifier.align(Alignment.TopEnd).size(28.dp)
                        ) {
                            Icon(Icons.Rounded.Close, "Remove", tint = ErrorRed, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        } else {
            // Empty state
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(DarkCard)
                    .border(1.dp, BorderColor, RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Rounded.Image, null, tint = TextTertiary, modifier = Modifier.size(48.dp))
                    Text("No images selected", style = MaterialTheme.typography.bodyMedium, color = TextTertiary)
                }
            }
        }

        // Generate button
        Button(
            onClick = {
                isGenerating = true
                // TODO: Use PdfBox to generate PDF from images
                // After generation: isGenerating = false; isComplete = true
            },
            enabled = selectedImages.isNotEmpty() && !isGenerating,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AccentBlue),
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            if (isGenerating) {
                CircularProgressIndicator(color = TextPrimary, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Generating PDF...", color = TextPrimary)
            } else {
                Icon(Icons.Rounded.PictureAsPdf, null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Generate PDF", style = MaterialTheme.typography.labelLarge, color = TextPrimary)
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
                    Text("PDF generated successfully!", style = MaterialTheme.typography.bodyMedium, color = SuccessGreen)
                }
            }
        }
    }
}
