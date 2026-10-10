from pathlib import Path
import sqlite3,json
db=Path.home()/'AppData/Local/PointNemo/point-nemo.sqlite'
con=sqlite3.connect(db.as_uri()+'?mode=ro',uri=True)
con.row_factory=sqlite3.Row
row=con.execute("SELECT j.state,j.error_code,j.timings_json,q.prompt_version,q.id FROM generation_jobs j LEFT JOIN question_sets q ON j.question_set_id=q.id ORDER BY j.started_at DESC LIMIT 1").fetchone()
print(json.dumps(dict(row)))
if row['state']=='ready':
    for question in con.execute("SELECT prompt,options_json,answer_index FROM questions_p0 WHERE question_set_id=? ORDER BY rowid",(row['id'],)):
        print(json.dumps(dict(question)))
con.close()
