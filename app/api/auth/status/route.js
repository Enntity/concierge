import { NextResponse } from "next/server";
import { auth } from "../../../../auth";

export async function HEAD() {
    const session = await auth();
    return new NextResponse(null, { status: session?.user ? 200 : 401 });
}

export async function GET() {
    const session = await auth();

    if (!session?.user) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
        authenticated: true,
        user: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
        },
    });
}
