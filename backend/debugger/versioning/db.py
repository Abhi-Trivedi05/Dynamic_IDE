from pymongo import MongoClient

client = MongoClient("mongodb+srv://apurav0711:kXLSO7w71BaWda0d@cluster0.loz7f.mongodb.net/?retryWrites=true&w=majority&appName=cluster0")

db = client['dynamic_ide']

versions_collection = db['file_versions']

