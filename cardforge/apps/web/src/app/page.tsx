"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredAuth } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
