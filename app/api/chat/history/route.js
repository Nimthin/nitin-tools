import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function GET(req) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get specific chat or all chats
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('id');

  if (chatId) {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();
      
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ chat: data });
  }

  // Get all chats (id and title only) for sidebar
  const { data, error } = await supabase
    .from('chats')
    .select('id, title, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chats: data });
}

export async function POST(req) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, messages } = await req.json();

  const { data, error } = await supabase
    .from('chats')
    .insert([{ user_id: userId, title, messages }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chat: data });
}

export async function PUT(req) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, messages, title } = await req.json();

  const { data, error } = await supabase
    .from('chats')
    .update({ messages, title, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chat: data });
}

export async function DELETE(req) {
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('id');

  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
