from datetime import datetime
from versioning.db import versions_collection

def save_version(path, content, diff, state):
    """
    Save file snapshot before modification.
    """

    latest = versions_collection.find_one(
        {"file_path": path},
        sort=[("version", -1)]
    )

    next_version = 1 if not latest else latest["version"] + 1

    versions_collection.insert_one({
        "file_path": path,
        "version": next_version,
        "content": content,
        "diff": diff,
        "goal": state.get("goal"),
        "step_index": state.get("step_index"),
        "created_at": datetime.utcnow(),
        "triggered_by": "agent"
    })


def get_versions(path):
    return list(
        versions_collection.find(
            {"file_path": path},
            {"_id": 0}
        ).sort("version", 1)
    )


def rollback(path, version):
    doc = versions_collection.find_one({
        "file_path": path,
        "version": version
    })

    if not doc:
        raise Exception("Version not found")

    return doc["content"]