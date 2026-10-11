# Data

All match data comes from [Cricsheet](https://cricsheet.org) (IPL ball-by-ball JSON, ODC-BY licence; attribution required).

- `raw/` — the downloaded `ipl_male_json.zip`. Ignored by git; re-download with `Update Data.bat` or:

  ```
  curl -L -o data/raw/ipl_male_json.zip https://cricsheet.org/downloads/ipl_male_json.zip
  ```

- The app reads `app/public/data/ipl.json`, which `scripts/build_data.py` builds from the zip. That file **is** committed so the app runs straight after a clone.

To rebuild after a new download:

```
python -I scripts/build_data.py data/raw/ipl_male_json.zip app/public/data/ipl.json
```

Seasons included and the simulated season are set at the top of `scripts/build_data.py`.
