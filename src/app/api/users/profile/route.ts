import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession, signToken, setSessionCookie } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { name, email, currentPassword, newPassword, image } = await req.json();

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    // 1. Handle name update
    if (name && name.trim()) {
      updateData.name = name.trim();
    }

    // 2. Handle email update
    if (email && email.trim() && email.trim().toLowerCase() !== user.email) {
      const targetEmail = email.trim().toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email: targetEmail } });
      if (existing && existing.id !== user.id) {
        return NextResponse.json({ error: "Email already in use." }, { status: 409 });
      }
      updateData.email = targetEmail;
    }

    // 3. Handle password update
    if (newPassword && newPassword.trim()) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required to update password." }, { status: 400 });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return NextResponse.json({ error: "Incorrect current password." }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    // 4. Handle image update
    if (image !== undefined) {
      updateData.image = image;
    }

    // If nothing to update, return early
    if (Object.keys(updateData).length === 0) {
      const authUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      };
      return NextResponse.json({
        data: { ...authUser, image: user.image || undefined },
        message: "No changes made.",
      });
    }

    // Perform database update
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    const updatedAuthUser = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
    };

    // Re-sign token with updated properties and update the session cookie
    const token = signToken(updatedAuthUser);
    const cookieConfig = setSessionCookie(token);

    const response = NextResponse.json({
      data: { ...updatedAuthUser, image: updatedUser.image || undefined },
      message: "Profile updated successfully.",
    });

    response.cookies.set(cookieConfig.name, cookieConfig.value, {
      httpOnly: cookieConfig.httpOnly,
      maxAge: cookieConfig.maxAge,
      path: cookieConfig.path,
      sameSite: cookieConfig.sameSite,
    });

    return response;
  } catch (err) {
    console.error("[PATCH /api/users/profile]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
