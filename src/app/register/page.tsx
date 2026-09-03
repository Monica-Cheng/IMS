"use client";

import { useFormState, useFormStatus } from "react-dom";
import { registerAdmin, registerStaff } from "@/app/auth/actions";
import Link from "next/link";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2.5 px-4 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function SuccessCard({ message }: { message: string }) {
  return (
    <div className="text-center py-4 space-y-4">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-sm text-slate-600">{message}</p>
      <Link href="/login" className="inline-block text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
        Go to sign in
      </Link>
    </div>
  );
}

function PasswordFields({ error }: { error: string | null }) {
  return (
    <>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent transition"
          placeholder="Min. 8 characters"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className={`w-full px-3.5 py-2.5 rounded-lg border bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent transition ${
            error ? "border-red-400" : "border-slate-200"
          }`}
          placeholder="••••••••"
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </>
  );
}

function validatePasswords(form: HTMLFormElement): boolean {
  const pw  = (form.elements.namedItem("password")        as HTMLInputElement).value;
  const cpw = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;
  return pw === cpw;
}

// ---------------------------------------------------------------------------
// Admin registration form
// ---------------------------------------------------------------------------
function AdminForm() {
  const [state, formAction] = useFormState(registerAdmin, { error: null });
  const [pwError, setPwError] = useState<string | null>(null);

  if (state.message) return <SuccessCard message={state.message} />;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!validatePasswords(e.currentTarget)) {
      e.preventDefault();
      setPwError("Passwords do not match.");
    } else {
      setPwError(null);
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="admin-name" className="block text-sm font-medium text-slate-700 mb-1.5">
          Your name
        </label>
        <input
          id="admin-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent transition"
          placeholder="Jane Smith"
        />
      </div>

      <div>
        <label htmlFor="admin-email" className="block text-sm font-medium text-slate-700 mb-1.5">
          Email address
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent transition"
          placeholder="owner@example.com"
        />
      </div>

      <PasswordFields error={pwError} />

      <SubmitButton label="Create admin account" pendingLabel="Creating account…" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Staff registration form
// ---------------------------------------------------------------------------
function StaffForm() {
  const [state, formAction] = useFormState(registerStaff, { error: null });
  const [pwError, setPwError] = useState<string | null>(null);

  if (state.message) return <SuccessCard message={state.message} />;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!validatePasswords(e.currentTarget)) {
      e.preventDefault();
      setPwError("Passwords do not match.");
    } else {
      setPwError(null);
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="staff-name" className="block text-sm font-medium text-slate-700 mb-1.5">
          Your name
        </label>
        <input
          id="staff-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent transition"
          placeholder="Alex Tan"
        />
      </div>

      <div>
        <label htmlFor="staff-email" className="block text-sm font-medium text-slate-700 mb-1.5">
          Email address
        </label>
        <input
          id="staff-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent transition"
          placeholder="staff@example.com"
        />
      </div>

      <PasswordFields error={pwError} />

      <div>
        <label htmlFor="businessCode" className="block text-sm font-medium text-slate-700 mb-1.5">
          Business code
        </label>
        <input
          id="businessCode"
          name="businessCode"
          type="text"
          required
          maxLength={8}
          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent transition"
          placeholder="Ask your manager"
        />
        <p className="mt-1 text-xs text-slate-400">
          8-character code shared by your manager from their Staff page.
        </p>
      </div>

      <SubmitButton label="Create staff account" pendingLabel="Creating account…" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
type Tab = "admin" | "staff";

export default function RegisterPage() {
  const [tab, setTab] = useState<Tab>("admin");

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1E3A5F] mb-4">
            <svg className="w-6 h-6 text-[#0EA5E9]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">StockBuddy POS</h1>
          <p className="text-sm text-slate-500 mt-1">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">

          {/* Tab switcher */}
          <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => setTab("admin")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                tab === "admin"
                  ? "bg-white text-[#1E3A5F] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              I&apos;m an owner
            </button>
            <button
              type="button"
              onClick={() => setTab("staff")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                tab === "staff"
                  ? "bg-white text-[#1E3A5F] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              I&apos;m a staff member
            </button>
          </div>

          {/* Context hint */}
          <p className="text-xs text-slate-400 mb-5 text-center">
            {tab === "admin"
              ? "Register your business and get immediate full access."
              : "Join your workplace with your manager's business code. Your account will stay pending until approved."}
          </p>

          {tab === "admin" ? <AdminForm /> : <StaffForm />}

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="text-[#0EA5E9] hover:text-[#0284C7] font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
