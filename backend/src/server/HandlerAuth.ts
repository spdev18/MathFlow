import { authService } from "../auth/auth.service";
import type { RegisterRequest, LoginRequest, LoginResponse } from "../protocol/backend-step.types";

export async function handlePostRegister(body: unknown): Promise<LoginResponse> {
    const req = body as RegisterRequest;
    if (!req.username || !req.password || !req.role) {
        return { status: "error", error: "Missing fields" };
    }

    try {
        const user = await authService.register(req.username, req.password, req.role);
        // Auto-login after register
        const token = await authService.login(req.username, req.password);
        if (!token) return { status: "error", error: "Login failed after register" };

        return {
            status: "ok",
            token: authService.generateTokenString(token),
            userId: user.id,
            role: user.role,
        };
    } catch (e) {
        return { status: "error", error: e instanceof Error ? e.message : String(e) };
    }
}

export async function handlePostLogin(body: unknown): Promise<LoginResponse> {
    const req = body as LoginRequest;
    if (!req.username || !req.password) {
        return { status: "error", error: "Missing username or password" };
    }

    const token = await authService.login(req.username, req.password);
    if (!token) {
        return { status: "error", error: "Invalid credentials" };
    }

    return {
        status: "ok",
        token: authService.generateTokenString(token),
        userId: token.userId,
        role: token.role,
    };
}
