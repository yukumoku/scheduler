<!DOCTYPE html>
<html lang="ja">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>ScheduleCraft</title>
        @if (! app()->runningUnitTests())
            @vite(['resources/css/app.css', 'resources/js/main.tsx'])
        @endif
    </head>
    <body>
        <div id="app"></div>
    </body>
</html>
