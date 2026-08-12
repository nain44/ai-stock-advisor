import json
import data_fetcher
q = data_fetcher.get_latest_quote('MARI', market='PK')
print(json.dumps(q, indent=2)[:4000])
