package com.nitintools.app.feature.image.ui

import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nitintools.app.core.ui.theme.*

/**
 * Background Remover — pick an image and remove its background using on-device AI.
 */
@Composable
fun BackgroundRemoverScreen() {
    var imageUri by remember { mutableStateOf<Uri?>(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var isComplete by remember { mutableStateOf(false) }

    val imagePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri -> imageUri = uri; isComplete = false }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .statusBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("✨ Background Remover", style = MaterialTheme.typography.displayMedium, color = TextPrimary)
        Text("Remove backgrounds using on-device AI — fully private", style = MaterialTheme.typography.bodyMedium, color = TextSecondary)

        // Image preview / picker
        Card(
            onClick = { imagePicker.launch("image/*") },
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkCard),
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            if (imageUri != null) {
                Box(modifier = Modifier.fillMaxSize()) {
                    AsyncImage(
                        model = imageUri,
                        contentDescription = "Selected image",
                        modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(16.dp)),
                        contentScale = ContentScale.Fit
                    )
                    // Overlay badge
                    if (isComplete) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(12.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(SuccessGreen)
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text("✅ Background Removed", style = MaterialTheme.typography.labelMedium, color = TextOnAccent)
                        }
                    }
                }
            } else {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(AccentPurple.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Rounded.AutoFixHigh, null, tint = AccentPurple, modifier = Modifier.size(36.dp))
                        }
                        Text("Tap to select an image", style = MaterialTheme.typography.titleMedium, color = TextPrimary)
                        Text("PNG, JPG, WEBP supported", style = MaterialTheme.typography.bodySmall, color = TextTertiary)
                    }
                }
            }
        }

        // Action buttons
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            if (imageUri != null) {
                OutlinedButton(
                    onClick = { imagePicker.launch("image/*") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(52.dp)
                ) {
                    Text("Change Image")
                }
            }
            Button(
                onClick = {
                    isProcessing = true
                    // TODO: Use ML Kit Subject Segmentation to remove background
                    // After processing: isProcessing = false; isComplete = true
                },
                enabled = imageUri != null && !isProcessing,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AccentPurple),
                modifier = Modifier.weight(1f).height(52.dp)
            ) {
                if (isProcessing) {
                    CircularProgressIndicator(color = TextPrimary, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Processing...", color = TextPrimary)
                } else {
                    Icon(Icons.Rounded.AutoFixHigh, null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Remove Background", color = TextPrimary)
                }
            }
        }

        if (isComplete) {
            Button(
                onClick = { /* TODO: Save result to gallery */ },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Icon(Icons.Rounded.Download, null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Save to Gallery", color = TextOnAccent)
            }
        }
    }
}
