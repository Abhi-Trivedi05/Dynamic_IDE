import os

from analyzer.extractor import extract_imports

def resolve(entry_file: str):
    visited = set()
    files = {}

    def dfs(file_path):
        file_path = os.path.abspath(file_path)

        if file_path in visited:
            return

        if not os.path.exists(file_path):
            return

        visited.add(file_path)
        # print("f")
        

        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            code = f.read()

        files[file_path] = code

        imports = extract_imports(code, file_path)

        for imp in imports:
            dfs(imp)

    dfs(entry_file)

    return {"files": files}
