import os

def extract_imports(code: str, current_file: str):
    imports = []
    base_dir = os.path.dirname(current_file)

    for line in code.splitlines():
        line = line.strip()
        print("not")

        if line.startswith("import "):
            module = line.split()[1]
            path = module.replace(".", "/") + ".py"
            imports.append(os.path.join(base_dir, path))

        elif line.startswith("from "):
            parts = line.split()
            module = parts[1]
            path = module.replace(".", "/") + ".py"
            imports.append(os.path.join(base_dir, path))

    return imports
