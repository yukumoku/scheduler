<!DOCTYPE html>
<html lang="ja">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Alloca</title>
        @if (! app()->runningUnitTests())
            @viteReactRefresh
            @vite(['resources/js/app.tsx'])
        @endif
    </head>
    <body>
        <div id="root"></div>
    </body>
</html>
