import { o as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-HWUekL9b.mjs";
import { t as GROK_PROVIDERS } from "./server-5jaz512o.mjs";
import { r as signIn, t as authClient } from "./client-B40BzJxt.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-screen-Ddp81uGG.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 font-medium transition-opacity duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", {
	variants: {
		variant: {
			primary: "bg-accent text-accent-fg hover:opacity-90",
			ghost: "bg-transparent text-ink hover:bg-accent-soft",
			outline: "border border-line-strong bg-surface text-ink hover:bg-accent-soft",
			danger: "bg-danger text-accent-fg hover:opacity-90"
		},
		size: {
			sm: "h-9 px-3 text-sm rounded-[var(--radius-sm)]",
			md: "h-11 px-4 text-sm rounded-[var(--radius-md)]",
			lg: "h-12 px-5 text-base rounded-[var(--radius-md)]",
			icon: "size-11 rounded-[var(--radius-md)]"
		}
	},
	defaultVariants: {
		variant: "primary",
		size: "md"
	}
});
function Button({ className, variant, size, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var requestWhatsappOtp = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("d867dfe388acac63aae92cc37b21f0dcac958f23e66fb147b5f5509514be742f"));
var verifyWhatsappOtp = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("75f3c2897820bb7184178899f2501c348f04f7be823106957078a1cc2e253932"));
var loadProfile = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("bbd71c36d0677d3058624dd01c82d1976c9ea9fa2ce9fd70265fe71a258cd4ad"));
var saveProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("4a60c2ccfa5a6273b24e0859a368c801034b7ee2c71cbd141cda607e6fb1c501"));
var saveLanguage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("5c31e13fa707c786ea03c2b64509d945590e8dfa16533841309719c4191c0c12"));
var rememberLoginPhone = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("8657fc208979db5be8c895a526039b5c6a194a34d67915473e65b08cc534277c"));
var listRegisteredVendors = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("d8690190df125a72450ce6419fdf48ea2ec9d1945243cef6194a42ad1de7968e"));
createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("e26edb810a555062b32b50707539e0147c6d3458ef579e4000a1090a438f699e"));
var openVendorInbox = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("6421f68dd021104d031e1ac526242b32cb01d52ff3aeb5bc24f97e2798f2f218"));
var saveTicket = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("5d97397af5e2f03ba0cf4120765df87688a4aab2db929ebc109c131b2f1a078d"));
var listIncomingTickets = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("e4f2510797cc5419271fb8a2007698b14fdf9d7ac51054cc27953f9a7e595266"));
var listTickets = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("ef79c1d52cca6c0acb5d220df320bda0b5bc3607c432e42d2fa39b56394733fe"));
var getTicket = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("5c7fcfb5bdb0b9e208a3bd3ec1201465d6285b9f5107f868993d81c76568252e"));
function LoginScreen() {
	const navigate = useNavigate();
	const [phone, setPhone] = (0, import_react.useState)("");
	const [code, setCode] = (0, import_react.useState)("");
	const [step, setStep] = (0, import_react.useState)("phone");
	const [waUrl, setWaUrl] = (0, import_react.useState)(null);
	const [previewCode, setPreviewCode] = (0, import_react.useState)(null);
	const [err, setErr] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function sendCode() {
		setErr(null);
		setBusy(true);
		const res = await requestWhatsappOtp({ data: { phone } });
		setBusy(false);
		if (!res.ok) {
			setErr(res.error);
			return;
		}
		setWaUrl(res.waUrl);
		setPreviewCode(res.previewCode);
		setStep("code");
	}
	async function confirmCode() {
		setErr(null);
		setBusy(true);
		const res = await verifyWhatsappOtp({ data: {
			phone,
			code
		} });
		if (!res.ok) {
			setBusy(false);
			setErr(res.error);
			return;
		}
		if ((await authClient.signUp.email({
			email: res.email,
			password: res.password,
			name: `Shop ${res.phone}`
		})).error) {
			const inn = await authClient.signIn.email({
				email: res.email,
				password: res.password
			});
			if (inn.error) {
				setBusy(false);
				setErr(inn.error.message ?? "Could not start session.");
				return;
			}
		}
		try {
			await authClient.getSession();
		} catch {}
		try {
			await rememberLoginPhone({ data: { phone: res.phone } });
		} catch {}
		setBusy(false);
		navigate({ to: "/" });
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "min-h-dvh bg-bg text-ink",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mx-auto grid min-h-dvh max-w-md place-items-center px-4 py-10",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full rounded-[var(--radius-xl)] border border-line bg-surface p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-3xl tracking-tight",
						children: "Vaani"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-1 text-lg font-medium",
						children: "Sign in with WhatsApp"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Indian mobile number. We send a 6-digit code in a WhatsApp message."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "mt-5 block text-xs text-muted",
							children: "Mobile"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1 flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "inline-flex h-11 items-center rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm text-muted",
								children: "+91"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								inputMode: "numeric",
								autoComplete: "tel",
								value: phone,
								onChange: (e) => setPhone(e.target.value),
								placeholder: "98765 43210",
								className: "h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
							})]
						}),
						step === "code" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "mt-4 block text-xs text-muted",
								children: "WhatsApp code"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								inputMode: "numeric",
								value: code,
								onChange: (e) => setCode(e.target.value),
								placeholder: "6 digits",
								className: "mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm tracking-[0.3em]"
							}),
							previewCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-sm text-ink",
								children: [
									"WhatsApp delivery in this preview: your code is",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium tracking-wide",
										children: previewCode
									})
								]
							}) : null,
							waUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: waUrl,
								target: "_blank",
								rel: "noreferrer",
								className: "mt-2 inline-flex h-11 items-center text-sm text-accent",
								children: "Open WhatsApp with this code"
							}) : null
						] }) : null,
						err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-danger",
							children: err
						}) : null,
						step === "phone" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "mt-5 w-full",
							size: "lg",
							disabled: busy,
							onClick: () => void sendCode(),
							children: busy ? "Sending…" : "Send WhatsApp code"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "mt-5 w-full",
							size: "lg",
							disabled: busy,
							onClick: () => void confirmCode(),
							children: busy ? "Signing in…" : "Verify and enter"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 border-t border-line pt-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-2 text-xs text-muted",
								children: "Or continue with"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2",
								children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									type: "button",
									variant: "outline",
									className: "w-full",
									onClick: () => void signIn(p.providerId, { callbackURL: "/" }),
									children: ["Continue with ", p.label]
								}, p.providerId))
							})]
						})
					] })
				]
			})
		})
	});
}
//#endregion
export { getTicket as a, listTickets as c, saveLanguage as d, saveProfile as f, createSsrRpc as i, loadProfile as l, LoginScreen as n, listIncomingTickets as o, saveTicket as p, cn as r, listRegisteredVendors as s, Button as t, openVendorInbox as u };
