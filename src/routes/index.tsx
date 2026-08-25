import { createFileRoute } from "@tanstack/react-router";
import { CustomerHome } from "@/components/customer-home";

export const Route = createFileRoute("/")({ component: CustomerHome });
