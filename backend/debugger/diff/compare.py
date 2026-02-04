import difflib

def diff_snapshots(old, new):
    if old is None:
        return new  # first run → return full output

    changed_files = {}

    old_files = old["files"]
    new_files = new["files"]
    print("hello")

    for file, new_code in new_files.items():
        old_code = old_files.get(file)

        if old_code is None:
            changed_files[file] = new_code
        elif old_code != new_code:
            diff = difflib.unified_diff(
                old_code.splitlines(),
                new_code.splitlines(),
                lineterm=""
            )
            changed_files[file] = "\n".join(diff)

    return {"files": changed_files}
