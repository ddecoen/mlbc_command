"""
MLBC Command — Local Build Server
Run: python app.py
Then open: http://localhost:5001
"""

import os, json, shutil
from flask import Flask, render_template, request, jsonify, send_file
from pipeline import process_csvs, build_dashboard

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024  # 64MB upload limit

SEASONS_DIR = os.path.join(os.path.dirname(__file__), 'data', 'seasons')
CURRENT_DIR = os.path.join(os.path.dirname(__file__), 'data', 'current')
INDEX_PATH  = os.path.join(os.path.dirname(__file__), 'index.html')

REQUIRED_CSVS = [
    'CareerBatStat.csv',
    'CareerPitStat.csv',
    'YearAllBatStat.csv',
    'YearAllPitStat.csv',
    'Players.csv',
    'SeasonIndBat.csv',
    'SeasonTeamBat.csv',
    'StatBatCompletePlayer.csv',
]

@app.route('/')
def index():
    seasons = sorted([
        d for d in os.listdir(SEASONS_DIR)
        if os.path.isdir(os.path.join(SEASONS_DIR, d)) and d.isdigit()
    ], reverse=True)
    return render_template('admin.html', seasons=seasons, required_csvs=REQUIRED_CSVS)

@app.route('/api/seasons')
def api_seasons():
    seasons = []
    for d in sorted(os.listdir(SEASONS_DIR), reverse=True):
        path = os.path.join(SEASONS_DIR, d)
        if os.path.isdir(path) and d.isdigit():
            meta_path = os.path.join(path, 'meta.json')
            meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
            seasons.append({'season': int(d), 'meta': meta})
    return jsonify(seasons)

@app.route('/api/upload', methods=['POST'])
def api_upload():
    season = request.form.get('season', '').strip()
    if not season or not season.isdigit():
        return jsonify({'error': 'Invalid season number'}), 400

    season = int(season)
    files = request.files

    # Check all required CSVs are present
    missing = [f for f in REQUIRED_CSVS if f not in files]
    if missing:
        return jsonify({'error': f'Missing files: {", ".join(missing)}'}), 400

    # Save uploaded CSVs to a temp dir
    import tempfile
    tmp = tempfile.mkdtemp()
    try:
        for name in REQUIRED_CSVS:
            files[name].save(os.path.join(tmp, name))

        # Run the processing pipeline
        result = process_csvs(tmp, season)

        # Save to seasons archive
        season_dir = os.path.join(SEASONS_DIR, str(season))
        os.makedirs(season_dir, exist_ok=True)
        for key, data in result['data'].items():
            with open(os.path.join(season_dir, f'{key}.json'), 'w') as f:
                json.dump(data, f)

        # Write meta
        with open(os.path.join(season_dir, 'meta.json'), 'w') as f:
            json.dump(result['meta'], f, indent=2)

        # Update current
        for fname in os.listdir(season_dir):
            shutil.copy(os.path.join(season_dir, fname), os.path.join(CURRENT_DIR, fname))

        # Rebuild dashboard
        build_dashboard(season)

        return jsonify({
            'success': True,
            'season': season,
            'meta': result['meta'],
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

@app.route('/api/set-active/<int:season>', methods=['POST'])
def api_set_active(season):
    """Switch the dashboard to show a different historical season."""
    season_dir = os.path.join(SEASONS_DIR, str(season))
    if not os.path.isdir(season_dir):
        return jsonify({'error': 'Season not found'}), 404
    for fname in os.listdir(season_dir):
        shutil.copy(os.path.join(season_dir, fname), os.path.join(CURRENT_DIR, fname))
    build_dashboard(season)
    return jsonify({'success': True, 'season': season})

@app.route('/dashboard')
def dashboard():
    return send_file(INDEX_PATH)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
