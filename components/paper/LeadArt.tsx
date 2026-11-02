"use client";

import { useState } from "react";
import styles from "./LeadArt.module.css";

/**
 * An image printed as newsprint: grayscale, a touch of contrast, and its white areas taking on
 * the paper color. A CSS filter, so it works on an image from any host. Images that fail to load
 * are left out rather than shown broken.
 */
export function LeadArt({ src, caption, credit }: { src: string; caption: string; credit: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className={styles.art}>
      <div className={styles.frame}>
        {/* A plain <img>: lead art comes from arbitrary hosts (image search), sized by its own ratio. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.image} src={src} alt={caption} loading="lazy" onError={() => setFailed(true)} />
      </div>
      <figcaption className={styles.caption}>
        {caption} <span className={styles.credit}>{credit}</span>
      </figcaption>
    </figure>
  );
}
