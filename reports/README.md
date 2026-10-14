# Weekly report generator

1. Install Python 3.10+ and check it: `python --version` (on Windows you can also try `py --version`).
2. In this folder run: `pip install -r requirements.txt`
3. List projects: `python weekly_report.py --list`
4. Make a report: `python weekly_report.py --project 1`

The Excel file is saved in `reports/output/`. The script reads the database settings
from `backend/.env`, so no password is stored in the Python code.
