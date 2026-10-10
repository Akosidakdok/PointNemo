from pathlib import Path
import sqlite3,json
db=Path.home()/'AppData/Local/PointNemo/point-nemo.sqlite'
con=sqlite3.connect(db.as_uri()+'?mode=ro',uri=True)
con.row_factory=sqlite3.Row
for row in con.execute("SELECT j.started_at,j.state,j.error_code,j.error_message,j.phase,d.filename FROM generation_jobs j JOIN documents d ON d.id=j.document_id ORDER BY j.started_at DESC LIMIT 3"):
    print(json.dumps(dict(row)))
con.close()
