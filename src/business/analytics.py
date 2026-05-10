import pandas as pd
import os

def get_anemia_stats():
    base_path= os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_path,"...", "Data", "anemia_stats.xlsx")

    try:
        df = pd.read_excel(file_path)
        
        data = df.to_dict(orient='records')
        return{"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}