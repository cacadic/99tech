export default function LoadingScreen() {
    return (
        <div className="min-h-screen w-full bg-[url('/images/background.jpg')] light:bg-[url('/images/background-light.jpg')] bg-no-repeat bg-cover">
            <div className="absolute inset-0 m-auto size-[400px]">
                {/* circle 1 */}
                <div
                    className="
            absolute inset-0 m-auto rounded-full
            bg-[rgba(138,43,226,0.02)]
            w-[200px] h-[180px]
            [box-shadow:0_0_1px_0_blueviolet,_inset_0_0_10px_0_blueviolet]
            animate-[rt_6s_linear_infinite]
          "
                />
                {/* circle 2 */}
                <div
                    className="
            absolute inset-0 m-auto rounded-full
            bg-[rgba(138,43,226,0.02)]
            w-[180px] h-[200px]
            [box-shadow:0_0_1px_0_darkviolet,_inset_0_0_10px_0_darkviolet]
            animate-[rt_10s_linear_infinite]
          "
                />
                {/* circle 3 */}
                <div
                    className="
            absolute inset-0 m-auto rounded-full
            bg-[rgba(138,43,226,0.02)]
            w-[210px] h-[190px]
            [box-shadow:0_0_1px_0_darkmagenta,_inset_0_0_10px_0_darkmagenta]
            animate-[rt_5s_linear_infinite]
          "
                />
                {/* circle 4 */}
                <div
                    className="
            absolute inset-0 m-auto rounded-full
            bg-[rgba(138,43,226,0.02)]
            w-[190px] h-[210px]
            [box-shadow:0_0_1px_0_magenta,_inset_0_0_10px_0_magenta]
            animate-[rt_15s_linear_infinite]
          "
                />
            </div>
        </div>
    );
}
