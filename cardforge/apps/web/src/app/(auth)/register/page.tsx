"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { register } from "@/lib/auth";
import type { ApiError } from "@/types";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", firstName: "", lastName: "",
    tenantName: "", tenantSlug: "",
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success("Account created! Welcome to CardForge.");
      router.replace("/dashboard");
    } catch (err) {
      const error = err as ApiError;
      toast.error(error.detail ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12">
      <div className="bg-card rounded-lg shadow-lg p-8 w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">Create your company</h1>
        <p className="text-center text-muted-foreground text-sm">
          Start with a free Starter plan
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "firstName", label: "First name", type: "text" },
              { key: "lastName", label: "Last name", type: "text" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1">{label}</label>
                <input type={type} onChange={set(key)} required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            ))}
          </div>
          {[
            { key: "email", label: "Email", type: "email" },
            { key: "password", label: "Password", type: "password" },
            { key: "tenantName", label: "Company name", type: "text" },
            { key: "tenantSlug", label: "Company slug (URL-safe)", type: "text" },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input type={type} onChange={set(key)} required
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
