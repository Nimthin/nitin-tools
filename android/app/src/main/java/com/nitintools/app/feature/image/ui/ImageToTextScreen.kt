package com.nitintools.app.feature.image.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nitintools.app.core.ui.theme.*

/**
 * Image to Text (OCR) — pick an image and extract text using ML Kit.
 */
@Composable
fun ImageToTextScreen() {
    var imageUri by remember { mutableStateOf<Uri?>(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var extractedText by remember { mutableStateOf("") }
    var isCopied by remember { mutableStateOf(false) }
    val clipboardManager = LocalClipboardManager.current

    val imagePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri -> imageUri = uri; extractedText = ""; isCopied = false }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .statusBarsPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("📝 Image to Text", style = MaterialTheme.typography.displayMedium, color = TextPrimary)
        Text("Extract text from any image using OCR", style = MaterialTheme.typography.bodyMedium, color = TextSecondary)

        // Image preview
        Card(
            onClick = { imagePicker.launch("image/*") },
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = DarkCard),
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 150.dp, max = 250.dp)
        ) {
            if (imageUri != null) {
                AsyncImage(
                    model = imageUri,
                    contentDescription = "Selected",
                    modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(16.dp)),
                    contentScale = ContentScale.Fit
                )
            } else {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Rounded.TextFields, null, tint = AccentCyan, modifier = Modifier.size(48.dp))
                        Text("Tap to select an image", style = MaterialTheme.typography.titleMedium, color = TextPrimary)
                    }
                }
            }
        }

        // Extract button
        Button(
            onClick = {
                isProcessing = true
                // TODO: Use ML Kit TextRecognition to extract text
                // val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                // After: extractedText = result.text; isProcessing = false
            },
            enabled = imageUri != null && !isProcessing,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = AccentCyan),
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) {
            if (isProcessing) {
                CircularProgressIndicator(color = TextOnAccent, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Extracting text...", color = TextOnAccent)
            } else {
                Icon(Icons.Rounded.DocumentScanner, null, tint = TextOnAccent, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Extract Text", style = MaterialTheme.typography.labelLarge, color = TextOnAccent)
            }
        }

        // Extracted text result
        if (extractedText.isNotBlank()) {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = DarkCard),
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Extracted Text", style = MaterialTheme.typography.titleSmall, color = TextPrimary)
                        TextButton(
                            onClick = {
                                clipboardManager.setText(AnnotatedString(extractedText))
                                isCopied = true
                            }
                        ) {
                            Icon(
                                if (isCopied) Icons.Rounded.Check else Icons.Rounded.ContentCopy,
                                null,
                                tint = if (isCopied) SuccessGreen else AccentCyan,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                if (isCopied) "Copied!" else "Copy",
                                color = if (isCopied) SuccessGreen else AccentCyan
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = extractedText,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                        modifier = Modifier.verticalScroll(rememberScrollState())
                    )
                }
            }
        }
    }
}
