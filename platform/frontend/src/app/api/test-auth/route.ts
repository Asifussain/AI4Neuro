import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to get user',
        error: userError.message,
      });
    }

    if (!user) {
      return NextResponse.json({
        status: 'unauthenticated',
        message: 'No user logged in',
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to get profile',
        error: profileError.message,
      });
    }

    return NextResponse.json({
      status: 'authenticated',
      user: {
        id: user.id,
        email: user.email,
        profile,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
    });
  }
}
