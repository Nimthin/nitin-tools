import { NextResponse } from "next/server";
import { supabase, STORAGE_BUCKET, isR2Configured } from "@/lib/r2-client";

// Global in-memory fallback for local development or when Supabase is not configured
// Keeps code operational locally with zero setup
const memoryRooms = new Map();

// Helper to clean up inactive members (last heart-beat > 10 seconds ago)
function cleanInactiveMembers(state) {
  const now = Date.now();
  const activeMembers = {};
  let changed = false;
  
  if (state.members) {
    for (const [userId, member] of Object.entries(state.members)) {
      if (now - member.lastActive < 10000) {
        activeMembers[userId] = member;
      } else {
        changed = true;
      }
    }
  }
  
  state.members = activeMembers;
  return changed;
}

// Formatter to render timestamps as readable MM:SS strings in system chat notifications
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export async function POST(req) {
  try {
    const { roomId, userId, username, playerState: clientPlayerState, action, message } = await req.json();

    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const cleanRoomId = roomId.trim().toUpperCase();
    const storagePath = `dinoplay/${cleanRoomId}.json`;
    
    let roomState = null;
    let isUsingMemory = !isR2Configured();

    if (isUsingMemory) {
      roomState = memoryRooms.get(cleanRoomId);
    } else {
      try {
        const { data, error } = await supabase
          .from("dinoplay_rooms")
          .select("*")
          .eq("room_code", cleanRoomId)
          .single();
          
        if (!error && data) {
          roomState = {
            roomCode: data.room_code,
            lastUpdated: data.last_updated,
            playerState: data.player_state,
            members: data.members,
            messages: data.messages
          };
        } else if (error && error.code !== "PGRST116") {
          console.warn("Supabase database error, falling back to memory:", error);
          isUsingMemory = true;
          roomState = memoryRooms.get(cleanRoomId);
        }
      } catch (e) {
        console.warn("Supabase connection failed, falling back to memory:", e);
        isUsingMemory = true;
        roomState = memoryRooms.get(cleanRoomId);
      }
    }

    const now = Date.now();

    // Initialize room state if it is a brand new session
    if (!roomState) {
      roomState = {
        roomCode: cleanRoomId,
        lastUpdated: now,
        playerState: {
          playing: false,
          currentTime: 0,
          playbackRate: 1,
          videoSource: "",
          sourceType: "none", // 'none' | 'file' | 'url' | 'youtube'
          videoName: "",
          senderId: userId || "system",
          updatedAt: now,
          version: 1
        },
        members: {},
        messages: []
      };
    }

    // Update active heartbeat for this member
    if (userId && username) {
      const isNewJoin = !roomState.members[userId];
      
      roomState.members[userId] = {
        username,
        lastActive: now
      };
      
      if (isNewJoin) {
        roomState.messages.push({
          id: `sys-${now}-${Math.random().toString(36).substr(2, 4)}`,
          sender: "system",
          text: `${username} joined the theater room.`,
          timestamp: now
        });
      }
    }

    // Clear stale users from presence panel
    cleanInactiveMembers(roomState);

    // Apply player state synchronization instructions
    if (action) {
      const oldState = roomState.playerState;
      let actionText = "";
      
      if (action === "play") {
        roomState.playerState = {
          ...oldState,
          playing: true,
          currentTime: clientPlayerState?.currentTime ?? oldState.currentTime,
          playbackRate: clientPlayerState?.playbackRate ?? oldState.playbackRate,
          senderId: userId || "system",
          updatedAt: now,
          version: oldState.version + 1
        };
        actionText = `${username || "Guest"} resumed playback.`;
      } else if (action === "pause") {
        roomState.playerState = {
          ...oldState,
          playing: false,
          currentTime: clientPlayerState?.currentTime ?? oldState.currentTime,
          senderId: userId || "system",
          updatedAt: now,
          version: oldState.version + 1
        };
        actionText = `${username || "Guest"} paused playback.`;
      } else if (action === "seek") {
        roomState.playerState = {
          ...oldState,
          currentTime: clientPlayerState?.currentTime ?? oldState.currentTime,
          senderId: userId || "system",
          updatedAt: now,
          version: oldState.version + 1
        };
        const formattedTime = formatTime(clientPlayerState?.currentTime ?? 0);
        actionText = `${username || "Guest"} seeked to ${formattedTime}.`;
      } else if (action === "rate") {
        roomState.playerState = {
          ...oldState,
          playbackRate: clientPlayerState?.playbackRate ?? oldState.playbackRate,
          senderId: userId || "system",
          updatedAt: now,
          version: oldState.version + 1
        };
        actionText = `${username || "Guest"} updated speed to ${clientPlayerState?.playbackRate ?? 1.0}x.`;
      } else if (action === "loadVideo") {
        roomState.playerState = {
          playing: false,
          currentTime: 0,
          playbackRate: 1,
          videoSource: clientPlayerState?.videoSource || "",
          sourceType: clientPlayerState?.sourceType || "none",
          videoName: clientPlayerState?.videoName || "",
          senderId: userId || "system",
          updatedAt: now,
          version: oldState.version + 1
        };
        
        let mediaDetails = clientPlayerState?.videoName || "new video source";
        if (clientPlayerState?.sourceType === "youtube") {
          mediaDetails = `YouTube video`;
        }
        actionText = `${username || "Guest"} loaded ${mediaDetails}.`;
      }

      if (actionText) {
        roomState.messages.push({
          id: `sys-${now}-${Math.random().toString(36).substr(2, 4)}`,
          sender: "system",
          text: actionText,
          timestamp: now
        });
      }
    }

    // Append standard user messages to the chat board
    if (message) {
      roomState.messages.push({
        id: `chat-${now}-${Math.random().toString(36).substr(2, 4)}`,
        sender: username || "Guest",
        userId: userId,
        text: message.text,
        timestamp: now
      });
      
      // Keep payload footprint small (truncate history at 50 records)
      if (roomState.messages.length > 50) {
        roomState.messages = roomState.messages.slice(-50);
      }
    }

    // Save final status object
    roomState.lastUpdated = now;
    if (isUsingMemory) {
      memoryRooms.set(cleanRoomId, roomState);
    } else {
      const { error: upsertError } = await supabase
        .from("dinoplay_rooms")
        .upsert({
          room_code: cleanRoomId,
          last_updated: now,
          player_state: roomState.playerState,
          members: roomState.members,
          messages: roomState.messages
        });
        
      if (upsertError) {
        console.error("Supabase database upsert error; reverting to server cache memory:", upsertError);
        memoryRooms.set(cleanRoomId, roomState);
        isUsingMemory = true;
      }
    }

    return NextResponse.json({
      ...roomState,
      isDemo: isUsingMemory
    });
  } catch (error) {
    console.error("DinoPlay sync endpoint failure:", error);
    return NextResponse.json({ error: error.message || "State sync failed" }, { status: 500 });
  }
}
