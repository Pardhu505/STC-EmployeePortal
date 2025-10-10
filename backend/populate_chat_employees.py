import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from mock_data_module import DEPARTMENT_DATA

# Load environment variables
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT_DIR, '.env'))

# MongoDB connection for Internal_communication database (your Atlas connection)
attendance_mongo_url = os.environ.get("ATTENDANCE_MONGO_URL")
attendance_client = AsyncIOMotorClient(attendance_mongo_url, tlsAllowInvalidCertificates=True)
chat_db = attendance_client['Internal_communication']

async def populate_chat_employees():
    employees = []
    for dept_key, sub_depts in DEPARTMENT_DATA.items():
        for sub_dept_key, emps in sub_depts.items():
            for emp in emps:
                emp_code = emp.get("Emp code", "").strip()
                employee = {
                    "id": emp_code if emp_code else emp["Email ID"],
                    "name": emp["Name"],
                    "email": emp["Email ID"],
                    "designation": emp["Designation"],
                    "department": dept_key,
                    "subDepartment": sub_dept_key,  # This should be correct
                    "reviewer": emp.get("Reviewer", ""),
                }
                employees.append(employee)

    # Clear existing employees collection
    await chat_db.employees.delete_many({})

    # Insert new employees
    if employees:
        result = await chat_db.employees.insert_many(employees)
        print(f"Inserted {len(result.inserted_ids)} employees into chat_db.employees collection.")
    else:
        print("No employees to insert.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(populate_chat_employees())
