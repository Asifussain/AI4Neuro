import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth, PENDING_ROLE_SELECTION } from "../components/AuthProvider";

export default function Home() {
  const { user, profile, loading: authLoading, session } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || authLoading) return; // wait until ready

    // Case 1: Not logged in → only redirect if we're exactly on "/"
    if (!user || !session) {
      if (router.pathname === "/") {
        router.replace("/landing");
      }
      return;
    }

    // Case 2: Logged in but no confirmed role
    if (
      !profile ||
      !profile.role ||
      profile.role === PENDING_ROLE_SELECTION ||
      !profile.role_confirmed
    ) {
      if (router.pathname !== "/complete-profile") {
        router.replace("/complete-profile");
      }
      return;
    }

    // Case 3: Logged in and confirmed → home page
    if (router.pathname !== "/home") {
      router.replace("/home");
    }
  }, [mounted, authLoading, user, session, profile, router]);

  return null; // no UI, just redirects
}
