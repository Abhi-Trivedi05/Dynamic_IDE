def detect_error(line: str) -> bool:
    keywords = [
        "Traceback",
        "Error:",
        "Exception",
        "Segmentation fault",
        "ModuleNotFoundError"
    ]
    return any(k in line for k in keywords)