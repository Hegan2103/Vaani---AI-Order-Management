import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  return <Navigate to="/" />;
}