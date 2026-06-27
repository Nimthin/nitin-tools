'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { allFoods } from './data';
import './calorie-counter.css';

export default function CalorieCounterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(1);

  // Image Upload / AI States
  const [imageSrc, setImageSrc] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const fileInputRef = useRef(null);

  // Filter autocomplete search suggestions (limit to 8)
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allFoods
      .filter(f => f.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery]);

  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setQuantity(1);
    setSearchQuery(''); // clear query after selection
    setAiResult(null); // clear AI status after selection
    setImageSrc(null); // clear image preview
  };

  // Live calculated macros
  const liveMacros = useMemo(() => {
    if (!selectedFood) return null;
    return {
      calories: Math.round(selectedFood.calories * quantity),
      protein: parseFloat((selectedFood.protein * quantity).toFixed(1)),
      carbs: parseFloat((selectedFood.carbs * quantity).toFixed(1)),
      fat: parseFloat((selectedFood.fat * quantity).toFixed(1)),
      fiber: parseFloat((selectedFood.fiber * quantity).toFixed(1)),
    };
  }, [selectedFood, quantity]);

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      setImageSrc(dataUrl);
      setSelectedFood(null);
      setAiResult(null);
      
      // Send image to backend Gemini API
      identifyFoodWithGemini(dataUrl, file.type, file.name);
    };
    reader.readAsDataURL(file);
  };

  // call local /api/chat with Gemini Model for multimodal food identification
  const identifyFoodWithGemini = async (base64Data, mimeType, fileName) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedModel: 'llama-3.2-11b-vision-preview',
          messages: [
            {
              role: 'user',
              content: 'Identify the primary food item in this picture. Reply with ONLY the exact name of the food item (e.g. "Roti", "Palak Paneer", "Samosa", "Pizza", "Apple", "Boiled Egg") and absolutely nothing else. No explanation, no punctuation, no markdown formatting.',
              file: {
                mimeType: mimeType,
                base64: base64Data
              }
            }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }

      // Extract identified food name
      const foodName = (data.message || '').trim().replace(/[."']/g, '');
      if (foodName) {
        const match = findBestDbMatch(foodName.toLowerCase());
        setAiResult({
          detected: foodName,
          matchFound: !!match,
          matchedFood: match,
        });

        if (match) {
          setSelectedFood(match);
          setQuantity(1);
        } else {
          // If no exact match, populate search query with the identified name so suggestions appear
          setSearchQuery(foodName);
        }
      } else {
        throw new Error('Empty response from AI');
      }
    } catch (error) {
      console.warn('Groq Llama vision identification failed, using filename fallback:', error);
      // Fallback heuristic: match based on file name
      const cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").toLowerCase();
      const match = findBestDbMatch(cleanName);
      
      setAiResult({
        detected: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        matchFound: !!match,
        matchedFood: match,
      });

      if (match) {
        setSelectedFood(match);
        setQuantity(1);
      } else {
        setSearchQuery(cleanName);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Find matching food in database using keyword matching
  const findBestDbMatch = (label) => {
    // 1. Direct match check on id or name
    const cleanLabel = label.toLowerCase().trim();
    let bestMatch = allFoods.find(
      f => f.name.toLowerCase() === cleanLabel || f.id.toLowerCase() === cleanLabel
    );
    if (bestMatch) return bestMatch;

    // 2. Keyword/substring matching
    bestMatch = allFoods.find(
      f => f.name.toLowerCase().includes(cleanLabel) || cleanLabel.includes(f.name.toLowerCase())
    );
    if (bestMatch) return bestMatch;

    // 3. Split by words and find matches for individual words
    const words = cleanLabel.split(/[\s,]+/);
    for (const word of words) {
      if (word.length > 2) {
        const match = allFoods.find(f => f.name.toLowerCase().includes(word));
        if (match) return match;
      }
    }

    return null;
  };

  return (
    <div className="cc-fullpage-container">
      {/* Top Header/Nav */}
      <header className="cc-nav">
        <Link href="/tools/fitness" className="cc-nav-back">
          ← Back
        </Link>
        <span className="cc-nav-title">⚡ NITIN TOOLS FITNESS</span>
        <div className="cc-nav-badge">CALORIE LOOKUP</div>
      </header>

      {/* Main Single-Pane Centered Workspace */}
      <main className="cc-centered-workspace">
        <div className="cc-search-card">
          <div className="cc-search-card-header">
            <h1>🔍 Food Calorie & Macro Lookup</h1>
            <p>Type to search 800+ foods or upload a picture for AI identification.</p>
          </div>

          {/* Search bar & Upload controls */}
          <div className="cc-search-section-v3">
            <div className="cc-search-controls-row">
              <div className="cc-search-input-wrapper-v3 flex-grow">
                <span className="cc-search-symbol-v3">🔍</span>
                <input
                  id="food-search-v3"
                  type="text"
                  className="cc-search-input-v3"
                  placeholder="Type to search... e.g. Roti, Paneer, Apple, Chicken"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                />
                {searchQuery && (
                  <button className="cc-clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>

              {/* Upload Image Button */}
              <button 
                className="cc-upload-btn-v3" 
                onClick={() => fileInputRef.current?.click()}
                title="Identify food from image"
              >
                📷 Upload Picture
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden-file-input"
                onChange={handleImageChange}
              />
            </div>

            {/* Suggestions list */}
            {searchSuggestions.length > 0 && (
              <ul className="cc-suggestions-list-v3">
                {searchSuggestions.map(food => (
                  <li
                    key={food.id}
                    className="cc-suggestion-item-v3"
                    onClick={() => handleSelectFood(food)}
                  >
                    <span className="cc-sugg-name-v3">{food.name}</span>
                    <span className="cc-sugg-serving-v3">{food.serving} · {food.calories} kcal</span>
                  </li>
                ))}
              </ul>
            )}

            {searchQuery.trim() && searchSuggestions.length === 0 && (
              <div className="cc-no-suggestions-v3">
                No matching foods found for &ldquo;{searchQuery}&rdquo;
              </div>
            )}
          </div>
        </div>

        {/* AI Analyzer Status */}
        {isAnalyzing && (
          <div className="cc-ai-analyzing-card animated-entry">
            <span className="cc-ai-loader-icon">🧠</span>
            <div>
              <h3>AI is identifying your food...</h3>
              <p>Analyzing pixels with Llama 3.2 Vision on Groq...</p>
            </div>
          </div>
        )}

        {/* Image Preview & AI Match Results */}
        {imageSrc && !isAnalyzing && (
          <div className="cc-image-preview-card animated-entry">
            <div className="cc-preview-img-wrapper">
              <img src={imageSrc} alt="Uploaded food" className="cc-uploaded-preview-img" />
            </div>
            {aiResult && (
              <div className="cc-ai-result-info">
                <h3>🔍 AI Detection Details:</h3>
                <p className="cc-detection-match">
                  Detected: <strong>{aiResult.detected}</strong>
                </p>
                {aiResult.matchFound ? (
                  <p className="cc-detection-matched-info">
                    ✨ Matched with database entry: <strong>{aiResult.matchedFood.name}</strong>
                  </p>
                ) : (
                  <p className="cc-detection-no-match-info">
                    ⚠️ No exact database match. Showing search results for <strong>&ldquo;{searchQuery}&rdquo;</strong> above.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Nutritional Display Card */}
        {selectedFood && !isAnalyzing ? (
          <div className="cc-display-card animated-entry">
            <div className="cc-display-header">
              <h2>{selectedFood.name}</h2>
              <span className="cc-display-category">Standard Serving: {selectedFood.serving}</span>
            </div>

            <div className="cc-display-body">
              {/* Stepper amount modifier */}
              <div className="cc-qty-section">
                <span className="cc-qty-label">Adjust Quantity / Servings:</span>
                <div className="cc-stepper-v3">
                  <button
                    type="button"
                    className="cc-step-btn-v3"
                    onClick={() => setQuantity(q => Math.max(0.25, q - 0.25))}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className="cc-qty-input-v3"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(0.1, parseFloat(e.target.value) || 1))}
                    step="0.25"
                    min="0.1"
                  />
                  <button
                    type="button"
                    className="cc-step-btn-v3"
                    onClick={() => setQuantity(q => q + 0.25)}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Big Macro Dashboard */}
              <div className="cc-macro-dashboard">
                <div className="cc-macro-cell cal">
                  <span className="cc-macro-val">{liveMacros.calories}</span>
                  <span className="cc-macro-lbl">Calories (kcal)</span>
                </div>
                <div className="cc-macro-cell pro">
                  <span className="cc-macro-val">{liveMacros.protein}g</span>
                  <span className="cc-macro-lbl">Protein</span>
                </div>
                <div className="cc-macro-cell carb">
                  <span className="cc-macro-val">{liveMacros.carbs}g</span>
                  <span className="cc-macro-lbl">Carbs</span>
                </div>
                <div className="cc-macro-cell fat">
                  <span className="cc-macro-val">{liveMacros.fat}g</span>
                  <span className="cc-macro-lbl">Fat</span>
                </div>
                <div className="cc-macro-cell fib">
                  <span className="cc-macro-val">{liveMacros.fiber}g</span>
                  <span className="cc-macro-lbl">Fiber</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          !imageSrc && !isAnalyzing && (
            <div className="cc-search-placeholder">
              <span className="cc-placeholder-art">🍉</span>
              <p>Ready to look up macros. Simply search for a food above or upload a picture to see its nutrient breakdown.</p>
            </div>
          )
        )}
      </main>
    </div>
  );
}
