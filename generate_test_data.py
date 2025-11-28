
import pandas as pd
import os

# Create the testdata directory if it doesn't exist
if not os.path.exists('testdata'):
    os.makedirs('testdata')

data = {'Zone': ['East', 'West'],
        'District': ['East Godavari', 'West Godavari'],
        'Parliament Constituency': ['Kakinada', 'Eluru'],
        'Assembly Constituency': ['Kakinada Rural', 'Eluru'],
        'Mandal': ['Kakinada Rural', 'Eluru'],
        'Village': ['Kakinada', 'Eluru'],
        'Booth No.': [1, 2],
        'Booth Name': ['Primary School', 'High School']
        }

df = pd.DataFrame(data)

df.to_excel('testdata/AP_Sample_Data.xlsx', index=False)
