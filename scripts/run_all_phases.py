"""Run Phase 1, 2, 3 sequentially. Stops if a phase fails."""
import subprocess, sys, os

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'download_tiles.py')

phases = [
    (1, 'Phase 1: World zoom 0-8'),
    (2, 'Phase 2: Major countries zoom 9-10'),
    (3, 'Phase 3: Scene cities zoom 10-15'),
]

for num, label in phases:
    print(f'\n{"="*60}')
    print(f'STARTING {label}')
    print(f'{"="*60}')
    result = subprocess.run([sys.executable, SCRIPT, f'--phase={num}'])
    if result.returncode != 0:
        print(f'\nERROR: {label} failed with code {result.returncode}')
        sys.exit(1)
    print(f'\nCOMPLETED: {label}')

print(f'\n{"="*60}')
print('ALL 3 PHASES COMPLETE')
print(f'{"="*60}')
