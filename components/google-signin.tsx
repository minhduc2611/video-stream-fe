'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from './auth-context';

declare global {
  interface Window {
    google: any;
  }
}

interface GoogleSignInProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: string;
}

export default function GoogleSignIn({
  onSuccess,
  onError,
  text = 'continue_with',
  theme = 'outline',
  size = 'large',
  shape = 'rectangular',
  logo_alignment = 'left',
  width = '300px'
}: GoogleSignInProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const { signInWithGoogle } = useAuth();

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google && buttonRef.current) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme,
          size,
          text,
          shape,
          logo_alignment,
          width,
        });
      }
    };

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [theme, size, text, shape, logo_alignment, width]);

  const handleCredentialResponse = async (response: any) => {
    try {
      await signInWithGoogle(response.credential);
      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Google sign-in failed';
      onError?.(errorMessage);
    }
  };

  return (
    <div className="flex justify-center">
      <div ref={buttonRef} />
    </div>
  );
}
