import mongoose from "mongoose";

const RepoSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please provide a name for the repository"],
    },
    path: {
        type: String,
        required: [true, "Physical path is required for terminal operations"],
    },
    owner: {
        type: String, // User's email from session
        required: [true, "Owner email is required"],
        index: true
    }
}, { timestamps: true });

const Repo = mongoose.models.Repo || mongoose.model("Repo", RepoSchema);

export default Repo;
