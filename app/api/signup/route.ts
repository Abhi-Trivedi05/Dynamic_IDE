import { NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json();

        console.log("Signup attempt for:", email);
        await connectDB();
        console.log("Connected to DB");

        const userExists = await User.findOne({ email });
        console.log("User exists check:", !!userExists);

        if (userExists) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        const hashedPassword = await bcryptjs.hash(password, 10);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
        });

        console.log("Saving user...");
        const savedUser = await newUser.save();
        console.log("User saved:", savedUser._id);

        return NextResponse.json({ message: "User registered successfully" }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
